import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'

// Helper function to get or create conversation for a transaction
async function getOrCreateConversationForTransaction(
  supabase: ReturnType<typeof createServerClient>,
  transactionId: string,
  buyerId: string,
  sellerId: string,
  adminId?: string
) {
  // First, try to find existing conversation by looking for participants
  const { data: existingParticipants, error: findError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', buyerId)
    .eq('role', 'buyer')

  if (findError) {
    console.error('Error finding existing conversation:', findError)
  }

  // Check if any of these conversations also have the seller
  if (existingParticipants && existingParticipants.length > 0) {
    for (const participant of existingParticipants) {
      const { data: sellerCheck } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', participant.conversation_id)
        .eq('user_id', sellerId)
        .eq('role', 'seller')
        .maybeSingle()

      if (sellerCheck) {
        // Found existing conversation
        const { data: conversation } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', participant.conversation_id)
          .single()

        if (conversation) {
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

  // Add participants
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

  const { error: participantsError } = await supabase
    .from('conversation_participants')
    .insert(participants)

  if (participantsError) {
    console.error('Error creating participants:', participantsError)
    // Clean up conversation if participants fail
    await supabase.from('conversations').delete().eq('id', newConversation.id)
    throw new Error('Failed to create conversation participants')
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
    const transaction = await prisma.escrowTransaction.findUnique({
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

    const supabase = createServerClient()

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
        { error: 'Failed to get or create conversation' },
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
        { error: 'Failed to fetch messages' },
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
  } catch (error) {
    console.error('Get conversation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
    const transaction = await prisma.escrowTransaction.findUnique({
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

    const supabase = createServerClient()

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
        { error: 'Failed to get or create conversation' },
        { status: 500 }
      )
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
        { error: 'Failed to create message' },
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
  } catch (error) {
    console.error('Post message error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

