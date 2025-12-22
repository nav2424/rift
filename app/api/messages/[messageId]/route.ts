import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'

/**
 * Mark a message as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await params
    const userId = auth.userId

    const supabase = createServerClient()

    // Get the message to check conversation_id
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('conversation_id, sender_id')
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Check if user is a participant in the conversation (but not the sender)
    if (message.sender_id === userId) {
      // Sender can't mark their own messages as read
      return NextResponse.json({ success: true })
    }

    const { data: participant, error: participantError } = await supabase
      .from('conversation_participants')
      .select('*')
      .eq('conversation_id', message.conversation_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Mark message as read (only if not already read)
    const { error: updateError } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .is('read_at', null) // Only update if not already read

    if (updateError) {
      console.error('Error marking message as read:', updateError)
      return NextResponse.json(
        { error: 'Failed to mark message as read' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark message as read error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Mark all messages in a conversation as read
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { conversationId } = body

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      )
    }

    const userId = auth.userId
    const supabase = createServerClient()

    // Check if user is a participant
    const { data: participant, error: participantError } = await supabase
      .from('conversation_participants')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle()

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Mark all unread messages in conversation as read (where user is not sender)
    const { error: updateError } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .is('read_at', null)
      .neq('sender_id', userId)

    if (updateError) {
      console.error('Error marking messages as read:', updateError)
      return NextResponse.json(
        { error: 'Failed to mark messages as read' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark messages as read error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await params
    const userId = auth.userId

    const supabase = createServerClient()

    // First, get the message to check ownership and get conversation_id
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('sender_id, conversation_id')
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Check if user is the sender (only sender can delete their own message)
    if (message.sender_id !== userId) {
      return NextResponse.json(
        { error: 'You can only delete your own messages' },
        { status: 403 }
      )
    }

    // Check if user is a participant in the conversation
    const { data: participant, error: participantError } = await supabase
      .from('conversation_participants')
      .select('*')
      .eq('conversation_id', message.conversation_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Delete the message
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)

    if (deleteError) {
      console.error('Error deleting message:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete message' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete message error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

