import { createClientClient } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface EscrowUpdate {
  id: string
  status: string
  updatedAt: string
  [key: string]: any // Allow other fields to be passed through
}

/**
 * Subscribe to escrow updates for a specific user
 * @param userId The user ID to subscribe to escrows for (buyer or seller)
 * @param onEscrowUpdate Callback when an escrow is updated
 * @param onNewEscrow Callback when a new escrow is created
 * @param onError Optional error callback
 * @returns A function to unsubscribe
 */
export function subscribeToUserEscrows(
  userId: string,
  onEscrowUpdate: (update: EscrowUpdate) => void,
  onNewEscrow?: (escrow: EscrowUpdate) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = createClientClient()

  // If Supabase is not configured, return a no-op unsubscribe function
  if (!supabase) {
    console.warn('Realtime escrow sync disabled: Supabase not configured')
    if (onError) {
      onError(new Error('Realtime escrow sync disabled: Supabase not configured'))
    }
    return () => {} // Return no-op unsubscribe function
  }

  // Subscribe to escrow updates where user is buyer or seller
  const channel = supabase
    .channel(`user_escrows:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'EscrowTransaction',
        filter: `buyerId=eq.${userId}`,
      },
      (payload) => {
        const update: EscrowUpdate = {
          id: payload.new.id,
          status: payload.new.status,
          updatedAt: payload.new.updatedAt || payload.new.updated_at,
          ...payload.new,
        }
        onEscrowUpdate(update)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'EscrowTransaction',
        filter: `sellerId=eq.${userId}`,
      },
      (payload) => {
        const update: EscrowUpdate = {
          id: payload.new.id,
          status: payload.new.status,
          updatedAt: payload.new.updatedAt || payload.new.updated_at,
          ...payload.new,
        }
        onEscrowUpdate(update)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'EscrowTransaction',
        filter: `buyerId=eq.${userId}`,
      },
      (payload) => {
        if (onNewEscrow) {
          const escrow: EscrowUpdate = {
            id: payload.new.id,
            status: payload.new.status,
            updatedAt: payload.new.createdAt || payload.new.created_at,
            ...payload.new,
          }
          onNewEscrow(escrow)
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'EscrowTransaction',
        filter: `sellerId=eq.${userId}`,
      },
      (payload) => {
        if (onNewEscrow) {
          const escrow: EscrowUpdate = {
            id: payload.new.id,
            status: payload.new.status,
            updatedAt: payload.new.createdAt || payload.new.created_at,
            ...payload.new,
          }
          onNewEscrow(escrow)
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to escrows for user ${userId}`)
      } else if (status === 'CHANNEL_ERROR') {
        const errorMessage = err?.message || 'Failed to subscribe to escrows'
        const error = new Error(errorMessage)
        console.error('Realtime escrow subscription error:', error)
        if (onError) {
          onError(error)
        }
      } else if (status === 'TIMED_OUT') {
        console.warn('Realtime escrow subscription timed out')
        if (onError) {
          onError(new Error('Subscription timed out - check your network connection'))
        }
      } else if (status === 'CLOSED') {
        console.log('Realtime escrow subscription closed')
      }
    })

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to updates for a specific escrow
 * @param escrowId The escrow ID to subscribe to
 * @param onUpdate Callback when the escrow is updated
 * @param onError Optional error callback
 * @returns A function to unsubscribe
 */
export function subscribeToEscrow(
  escrowId: string,
  onUpdate: (update: EscrowUpdate) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = createClientClient()

  // If Supabase is not configured, return a no-op unsubscribe function
  if (!supabase) {
    console.warn('Realtime escrow sync disabled: Supabase not configured')
    if (onError) {
      onError(new Error('Realtime escrow sync disabled: Supabase not configured'))
    }
    return () => {} // Return no-op unsubscribe function
  }

  const channel = supabase
    .channel(`escrow:${escrowId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'EscrowTransaction',
        filter: `id=eq.${escrowId}`,
      },
      (payload) => {
        const update: EscrowUpdate = {
          id: payload.new.id,
          status: payload.new.status,
          updatedAt: payload.new.updatedAt || payload.new.updated_at,
          ...payload.new,
        }
        onUpdate(update)
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to escrow ${escrowId}`)
      } else if (status === 'CHANNEL_ERROR') {
        const errorMessage = err?.message || 'Failed to subscribe to escrow'
        const error = new Error(errorMessage)
        console.error('Realtime escrow subscription error:', error)
        if (onError) {
          onError(error)
        }
      }
    })

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

