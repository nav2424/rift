import { createClientClient } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface Message {
  id: string
  body: string
  senderId: string | null
  createdAt: string
  readAt: string | null
}

export interface ConversationUpdate {
  id: string
  lastMessageAt: string | null
  createdAt: string
}

/**
 * Subscribe to new messages in a conversation
 * @param conversationId The conversation ID to subscribe to
 * @param onMessage Callback when a new message is received
 * @param onError Optional error callback
 * @returns A function to unsubscribe
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: Message) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = createClientClient()

  // If Supabase is not configured, return a no-op unsubscribe function
  if (!supabase) {
    console.warn('Realtime messaging disabled: Supabase not configured')
    if (onError) {
      onError(new Error('Realtime messaging disabled: Supabase not configured'))
    }
    return () => {} // Return no-op unsubscribe function
  }

  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const newMessage: Message = {
          id: payload.new.id,
          body: payload.new.body,
          senderId: payload.new.sender_id,
          createdAt: payload.new.created_at,
          readAt: payload.new.read_at,
        }
        onMessage(newMessage)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to messages for conversation ${conversationId}`)
      } else if (status === 'CHANNEL_ERROR') {
        // Realtime subscription failed - this is non-critical
        // Messages will still work via polling/refresh, just without real-time updates
        const error = new Error('Realtime subscription unavailable. Messages will still work, but updates may be delayed.')
        console.warn(`Realtime subscription failed for conversation ${conversationId}:`, error.message)
        console.warn('This is usually because:')
        console.warn('1. Realtime is not enabled in Supabase Dashboard (Database → Replication)')
        console.warn('2. The messages table is not added to the supabase_realtime publication')
        console.warn('3. Or Supabase Realtime service is temporarily unavailable')
        if (onError) {
          onError(error)
        }
      } else if (status === 'TIMED_OUT') {
        console.warn(`Realtime subscription timed out for conversation ${conversationId}`)
        if (onError) {
          onError(new Error('Realtime subscription timed out'))
        }
      } else if (status === 'CLOSED') {
        console.log(`Realtime subscription closed for conversation ${conversationId}`)
      }
    })

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to conversation updates (e.g., last_message_at changes)
 * @param conversationId The conversation ID to subscribe to
 * @param onUpdate Callback when conversation is updated
 * @param onError Optional error callback
 * @returns A function to unsubscribe
 */
export function subscribeToConversation(
  conversationId: string,
  onUpdate: (update: ConversationUpdate) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = createClientClient()

  // If Supabase is not configured, return a no-op unsubscribe function
  if (!supabase) {
    console.warn('Realtime messaging disabled: Supabase not configured')
    if (onError) {
      onError(new Error('Realtime messaging disabled: Supabase not configured'))
    }
    return () => {} // Return no-op unsubscribe function
  }

  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${conversationId}`,
      },
      (payload) => {
        const update: ConversationUpdate = {
          id: payload.new.id,
          lastMessageAt: payload.new.last_message_at,
          createdAt: payload.new.created_at,
        }
        onUpdate(update)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to conversation ${conversationId}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.warn(`Realtime subscription failed for conversation ${conversationId}`)
        if (onError) {
          onError(new Error('Realtime subscription unavailable'))
        }
      } else if (status === 'TIMED_OUT') {
        console.warn(`Realtime subscription timed out for conversation ${conversationId}`)
        if (onError) {
          onError(new Error('Realtime subscription timed out'))
        }
      }
    })

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to all conversations for a user (via conversation_participants)
 * @param userId The user ID to subscribe to conversations for
 * @param onNewConversation Callback when user joins a new conversation
 * @param onError Optional error callback
 * @returns A function to unsubscribe
 */
export function subscribeToUserConversations(
  userId: string,
  onNewConversation: (conversationId: string) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = createClientClient()

  // If Supabase is not configured, return a no-op unsubscribe function
  if (!supabase) {
    console.warn('Realtime messaging disabled: Supabase not configured')
    if (onError) {
      onError(new Error('Realtime messaging disabled: Supabase not configured'))
    }
    return () => {} // Return no-op unsubscribe function
  }

  const channel = supabase
    .channel(`user_conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNewConversation(payload.new.conversation_id)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to conversations for user ${userId}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.warn(`Realtime subscription failed for user conversations ${userId}`)
        if (onError) {
          onError(new Error('Realtime subscription unavailable'))
        }
      } else if (status === 'TIMED_OUT') {
        console.warn(`Realtime subscription timed out for user conversations ${userId}`)
        if (onError) {
          onError(new Error('Realtime subscription timed out'))
        }
      }
    })

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

