import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { moderateAndAction } from '@/lib/ai/message-moderation'

// Helper function to get or create conversation for a transaction
async function getOrCreateConversationForTransaction(
  supabase: ReturnType<typeof createServerClient>,
  transactionId: string,
  buyerId: string,
  sellerId: string,
  adminId?: string
) {
  // First, try to find existing conversation by looking for conversations with both buyer and seller
  // Get all conversations where buyer is a participant
  const { data: buyerParticipants, error: findError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', buyerId)
    .eq('role', 'buyer')

  if (findError) {
    console.error('Error finding existing conversation:', findError)
  }

  // Check if any of these conversations also have the seller
  if (buyerParticipants && buyerParticipants.length > 0) {
    // Get unique conversation IDs
    const conversationIds = [...new Set(buyerParticipants.map(p => p.conversation_id))]
    
    // Check which of these conversations have the seller
    for (const conversationId of conversationIds) {
      const { data: sellerCheck } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', sellerId)
        .eq('role', 'seller')
        .maybeSingle()

      if (sellerCheck) {
        // Found existing conversation - verify it exists and return it
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single()

        if (conversation && !convError) {
          // Ensure all participants exist (in case admin was added later)
          if (adminId) {
            const { data: adminCheck } = await supabase
              .from('conversation_participants')
              .select('conversation_id')
              .eq('conversation_id', conversation.id)
              .eq('user_id', adminId)
              .eq('role', 'admin')
              .maybeSingle()

            if (!adminCheck) {
              // Add admin participant if missing (ignore duplicates)
              try {
                const { error: insertError } = await supabase
                  .from('conversation_participants')
                  .insert({
                    conversation_id: conversation.id,
                    user_id: adminId,
                    role: 'admin',
                  })
                
                // Ignore duplicate errors for admin
                if (insertError && insertError.code !== '23505' && !insertError.message?.includes('duplicate')) {
                  console.error('Error adding admin participant:', insertError)
                }
              } catch (error) {
                // Ignore duplicate errors for admin
              }
            }
          }
          return conversation
        }
      }
    }
  }

  // Create new conversation
  const { data: newConversation, error: createError } = await supabase
    .from('conversations')
    .insert({})
    .select()
    .single()

  if (createError || !newConversation) {
    throw new Error('Failed to create conversation')
  }

  // Add participants, checking for existence first to avoid duplicates
  const participants = [
    { conversation_id: newConversation.id, user_id: buyerId, role: 'buyer' },
    { conversation_id: newConversation.id, user_id: sellerId, role: 'seller' },
  ]

  if (adminId) {
    participants.push({
      conversation_id: newConversation.id,
      user_id: adminId,
      role: 'admin',
    })
  }

  // Insert participants one by one, handling duplicates gracefully
  for (const participant of participants) {
    // Check if participant already exists
    const { data: existing } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', participant.conversation_id)
      .eq('user_id', participant.user_id)
      .maybeSingle()

    // Only insert if doesn't exist
    if (!existing) {
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert(participant)

      if (participantError) {
        // Check if it's a duplicate key error (23505) - that's okay, participant already exists
        const isDuplicate = participantError.code === '23505' || 
                           participantError.message?.includes('duplicate') ||
                           participantError.message?.includes('already exists')
        
        if (!isDuplicate) {
          console.error('Error creating participant:', participantError)
          // Clean up conversation if participants fail (non-duplicate error)
          await supabase.from('conversations').delete().eq('id', newConversation.id)
          throw new Error('Failed to create conversation participants')
        }
        // If it's a duplicate, that's fine - participant already exists (race condition)
      }
    }
  }

  return newConversation
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { transactionId } = await params
    const userId = auth.userId

    // Validate that the user is either buyer or seller on this transaction
    // Try Prisma first, fallback to raw SQL if enum validation fails or columns don't exist
    let transaction: any
    try {
      transaction = await prisma.riftTransaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
        },
      })
    } catch (findError: any) {
      const isEnumError = findError?.message?.includes('enum') || 
                          findError?.message?.includes('not found in enum') ||
                          findError?.message?.includes("Value 'TICKETS'") ||
                          findError?.message?.includes("Value 'DIGITAL'")
      const isColumnError = findError?.code === 'P2022' || 
                            findError?.message?.includes('does not exist in the current database') ||
                            (findError?.message?.includes('column') && findError?.message?.includes('does not exist'))
      
      if (isEnumError || isColumnError) {
        // Fetch transaction using raw SQL with text casting to avoid enum/column validation
        const fetchedTransactions = await prisma.$queryRawUnsafe<any[]>(`
          SELECT id, "buyerId", "sellerId"
          FROM "EscrowTransaction"
          WHERE id = $1
        `, transactionId)
        
        if (!fetchedTransactions || fetchedTransactions.length === 0) {
          return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
        }
        
        transaction = fetchedTransactions[0]
      } else {
        throw findError
      }
    }

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const isBuyer = transaction.buyerId === userId
    const isSeller = transaction.sellerId === userId

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let supabase
    try {
      supabase = createServerClient()
    } catch (error: any) {
      console.error('Supabase configuration error:', error)
      return NextResponse.json(
        { 
          error: 'Internal server error',
          details: error?.message?.includes('Supabase configuration missing')
            ? error.message + '\n\nPlease ensure your Next.js dev server has been restarted after adding environment variables.'
            : error.message || 'Supabase environment variables are missing'
        },
        { status: 500 }
      )
    }

    // Get or create conversation
    let conversation
    try {
      conversation = await getOrCreateConversationForTransaction(
        supabase,
        transactionId,
        transaction.buyerId,
        transaction.sellerId,
        auth.userRole === 'ADMIN' ? userId : undefined
      )
    } catch (error: any) {
      console.error('Error getting/creating conversation:', error)
      return NextResponse.json(
        { 
          error: 'Failed to get or create conversation',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json(
        { 
          error: 'Failed to fetch messages',
          details: messagesError.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        createdAt: conversation.created_at,
        lastMessageAt: conversation.last_message_at,
      },
      messages: (messages || []).map((msg) => ({
        id: msg.id,
        body: msg.body,
        senderId: msg.sender_id,
        createdAt: msg.created_at,
        readAt: msg.read_at,
      })),
    })
  } catch (error: any) {
    console.error('Get conversation error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error?.message || 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { transactionId } = await params
    const userId = auth.userId

    const body = await request.json()
    const { body: messageBody } = body

    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message body is required' },
        { status: 400 }
      )
    }

    // Validate that the user is either buyer or seller on this transaction
    const transaction = await prisma.riftTransaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
      },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const isBuyer = transaction.buyerId === userId
    const isSeller = transaction.sellerId === userId

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let supabase
    try {
      supabase = createServerClient()
    } catch (error: any) {
      console.error('Supabase configuration error:', error)
      return NextResponse.json(
        { 
          error: 'Internal server error',
          details: error?.message?.includes('Supabase configuration missing')
            ? error.message + '\n\nPlease ensure your Next.js dev server has been restarted after adding environment variables.'
            : error.message || 'Supabase environment variables are missing'
        },
        { status: 500 }
      )
    }

    // Get or create conversation
    let conversation
    try {
      conversation = await getOrCreateConversationForTransaction(
        supabase,
        transactionId,
        transaction.buyerId,
        transaction.sellerId,
        auth.userRole === 'ADMIN' ? userId : undefined
      )
    } catch (error: any) {
      console.error('Error getting/creating conversation:', error)
      return NextResponse.json(
        { 
          error: 'Failed to get or create conversation',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    // AI Message Moderation
    const moderationResult = await moderateAndAction(messageBody.trim(), {
      conversationId: conversation.id,
      senderId: userId,
      receiverId: isBuyer ? transaction.sellerId : transaction.buyerId,
      riftId: transactionId,
    })

    if (!moderationResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Message blocked',
          reason: moderationResult.moderationResult.reasoning,
          severity: moderationResult.moderationResult.severity,
        },
        { status: 403 }
      )
    }

    // If flagged but allowed, log it for admin review
    if (moderationResult.moderationResult.action === 'flag' || moderationResult.moderationResult.action === 'alert') {
      console.warn(`[MODERATION FLAG] Message flagged: ${moderationResult.moderationResult.reasoning}`, {
        conversationId: conversation.id,
        transactionId,
        senderId: userId,
        severity: moderationResult.moderationResult.severity,
      })
    }

    // Insert new message (trigger will update last_message_at)
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: userId,
        body: messageBody.trim(),
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error creating message:', messageError)
      return NextResponse.json(
        { 
          error: 'Failed to create message',
          details: messageError.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: message.id,
      body: message.body,
      senderId: message.sender_id,
      createdAt: message.created_at,
      readAt: message.read_at,
    })
  } catch (error: any) {
    console.error('Post message error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error?.message || 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

