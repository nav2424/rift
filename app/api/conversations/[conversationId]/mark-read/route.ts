import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'

/**
 * Mark all messages in a conversation as read
 */
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
