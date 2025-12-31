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

        return conversation
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
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = await params
    const userId = auth.userId

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
            : error.message || 'Supabase environment variables are missing',
        },
        { status: 500 }
      )
    }

    // Check if user is a participant
    const { data: participant, error: participantError } = await supabase
    .from('conversation_participants')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()

    if (participantError) {
      console.error('Error checking participant:', participantError)
      return NextResponse.json(
        { error: 'Failed to verify access' },
        { status: 500 }
      )
    }

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
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
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = await params
    const userId = auth.userId

    const body = await request.json()
    const { body: messageBody } = body

    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message body is required' },
        { status: 400 }
      )
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
            : error.message || 'Supabase environment variables are missing',
        },
        { status: 500 }
      )
    }

    // Check if user is a participant
    const { data: participant, error: participantError } = await supabase
      .from('conversation_participants')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle()

    if (participantError) {
      console.error('Error checking participant:', participantError)
      return NextResponse.json(
        { error: 'Failed to verify access' },
        { status: 500 }
      )
    }

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // AI Message Moderation
    const moderationResult = await moderateAndAction(messageBody.trim(), {
      conversationId,
      senderId: userId,
      riftId: undefined, // Will be determined from conversation if needed
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
        conversationId,
        senderId: userId,
        severity: moderationResult.moderationResult.severity,
      })
    }

    // Insert new message (trigger will update last_message_at)
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = await params
    const userId = auth.userId

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
            : error.message || 'Supabase environment variables are missing',
        },
        { status: 500 }
      )
    }

    // Check if user is a participant
    const { data: participant, error: participantError } = await supabase
      .from('conversation_participants')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle()

    if (participantError) {
      console.error('Error checking participant:', participantError)
      return NextResponse.json(
        { error: 'Failed to verify access' },
        { status: 500 }
      )
    }

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete all messages in the conversation
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId)

    if (messagesError) {
      console.error('Error deleting messages:', messagesError)
      return NextResponse.json(
        { error: 'Failed to delete messages' },
        { status: 500 }
      )
    }

    // Delete all participants
    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)

    if (participantsError) {
      console.error('Error deleting participants:', participantsError)
      return NextResponse.json(
        { error: 'Failed to delete participants' },
        { status: 500 }
      )
    }

    // Delete the conversation
    const { error: conversationError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)

    if (conversationError) {
      console.error('Error deleting conversation:', conversationError)
      return NextResponse.json(
        { error: 'Failed to delete conversation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete conversation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

