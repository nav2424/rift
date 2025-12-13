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
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to messages for conversation ${conversationId}`)
      } else if (status === 'CHANNEL_ERROR') {
        const errorMessage = err?.message || 'Failed to subscribe to messages'
        const error = new Error(errorMessage)
        console.error('Realtime subscription error:', error)
        if (onError) {
          onError(error)
        }
      } else if (status === 'TIMED_OUT') {
        console.warn('Realtime subscription timed out for messages')
        if (onError) {
          onError(new Error('Subscription timed out - check your network connection'))
        }
      } else if (status === 'CLOSED') {
        console.log('Realtime subscription closed for messages')
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
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to conversation ${conversationId}`)
      } else if (status === 'CHANNEL_ERROR') {
        const errorMessage = err?.message || 'Failed to subscribe to conversation'
        const error = new Error(errorMessage)
        console.error('Realtime subscription error:', error)
        if (onError) {
          onError(error)
        }
      } else if (status === 'TIMED_OUT') {
        console.warn('Realtime subscription timed out for conversation')
        if (onError) {
          onError(new Error('Subscription timed out - check your network connection'))
        }
      } else if (status === 'CLOSED') {
        console.log('Realtime subscription closed for conversation')
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
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to conversations for user ${userId}`)
      } else if (status === 'CHANNEL_ERROR') {
        // Only log as warning since subscription might retry and succeed
        const errorMessage = err?.message || 'Failed to subscribe to user conversations'
        console.warn(`Realtime subscription warning for user conversations: ${errorMessage}`)
        // Only call error callback if provided - let the caller decide how to handle
        if (onError) {
          onError(new Error(errorMessage))
        }
      } else if (status === 'TIMED_OUT') {
        console.warn('Realtime subscription timed out for user conversations - will retry')
        if (onError) {
          onError(new Error('Subscription timed out - check your network connection'))
        }
      } else if (status === 'CLOSED') {
        console.log('Realtime subscription closed for user conversations')
      }
    })

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

