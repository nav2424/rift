import { createClientClient } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface RiftUpdate {
  id: string
  status: string
  updatedAt: string
  [key: string]: any // Allow other fields to be passed through
}

/**
 * Subscribe to rift updates for a specific user
 * @param userId The user ID to subscribe to rifts for (buyer or seller)
 * @param onRiftUpdate Callback when a rift is updated
 * @param onNewRift Callback when a new rift is created
 * @param onError Optional error callback
 * @returns A function to unsubscribe
 */
export function subscribeToUserRifts(
  userId: string,
  onRiftUpdate: (update: RiftUpdate) => void,
  onNewRift?: (rift: RiftUpdate) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = createClientClient()

  // If Supabase is not configured, return a no-op unsubscribe function
  if (!supabase) {
    console.warn('Realtime rift sync disabled: Supabase not configured')
    if (onError) {
      onError(new Error('Realtime rift sync disabled: Supabase not configured'))
    }
    return () => {} // Return no-op unsubscribe function
  }

  // Subscribe to rift updates where user is buyer or seller
  const channel = supabase
    .channel(`user_rifts:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'EscrowTransaction',
        filter: `buyerId=eq.${userId}`,
      },
      (payload) => {
        if (!payload.new || !payload.new.id) {
          console.warn('Invalid rift update payload:', payload)
          return
        }
        try {
          const update: EscrowUpdate = {
            id: payload.new.id,
            status: payload.new.status,
            updatedAt: payload.new.updatedAt || payload.new.updated_at,
            ...payload.new,
          }
          onEscrowUpdate(update)
        } catch (error) {
          console.error('Error processing rift update:', error, payload)
        }
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
        if (!payload.new || !payload.new.id) {
          console.warn('Invalid rift update payload:', payload)
          return
        }
        try {
          const update: RiftUpdate = {
            id: payload.new.id,
            status: payload.new.status,
            updatedAt: payload.new.updatedAt || payload.new.updated_at,
            ...payload.new,
          }
          onRiftUpdate(update)
        } catch (error) {
          console.error('Error processing rift update:', error, payload)
        }
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
        if (!payload.new || !payload.new.id) {
          console.warn('Invalid rift insert payload:', payload)
          return
        }
        if (onNewRift) {
          try {
            const rift: RiftUpdate = {
              id: payload.new.id,
              status: payload.new.status,
              updatedAt: payload.new.createdAt || payload.new.created_at,
              ...payload.new,
            }
            onNewRift(rift)
          } catch (error) {
            console.error('Error processing new rift:', error, payload)
          }
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
        if (!payload.new || !payload.new.id) {
          console.warn('Invalid rift insert payload:', payload)
          return
        }
        if (onNewRift) {
          try {
            const rift: RiftUpdate = {
              id: payload.new.id,
              status: payload.new.status,
              updatedAt: payload.new.createdAt || payload.new.created_at,
              ...payload.new,
            }
            onNewRift(rift)
          } catch (error) {
            console.error('Error processing new rift:', error, payload)
          }
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to rifts for user ${userId}`)
      } else if (status === 'CHANNEL_ERROR') {
        // Silently handle realtime errors - these are non-critical
        // Realtime sync is a nice-to-have feature, not essential for functionality
        console.debug('Realtime rift subscription error (non-critical):', err?.message || 'Unknown error')
        if (onError) {
          onError(new Error('Realtime sync unavailable'))
        }
      } else if (status === 'TIMED_OUT') {
        // Silently handle timeouts - realtime sync will work on next page load
        console.debug('Realtime rift subscription timed out (non-critical)')
        if (onError) {
          onError(new Error('Realtime sync unavailable'))
        }
      } else if (status === 'CLOSED') {
        console.log('Realtime rift subscription closed')
      }
    })

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to updates for a specific rift
 * @param riftId The rift ID to subscribe to
 * @param onUpdate Callback when the rift is updated
 * @param onError Optional error callback
 * @returns A function to unsubscribe
 */
export function subscribeToRift(
  riftId: string,
  onUpdate: (update: RiftUpdate) => void,
  onError?: (error: Error) => void
): () => void {
  const supabase = createClientClient()

  // If Supabase is not configured, return a no-op unsubscribe function
  if (!supabase) {
    console.warn('Realtime rift sync disabled: Supabase not configured')
    if (onError) {
      onError(new Error('Realtime rift sync disabled: Supabase not configured'))
    }
    return () => {} // Return no-op unsubscribe function
  }

  const channel = supabase
    .channel(`rift:${riftId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'EscrowTransaction',
        filter: `id=eq.${riftId}`,
      },
      (payload) => {
        if (!payload.new || !payload.new.id) {
          console.warn('Invalid rift update payload:', payload)
          return
        }
        try {
          const update: RiftUpdate = {
            id: payload.new.id,
            status: payload.new.status,
            updatedAt: payload.new.updatedAt || payload.new.updated_at,
            ...payload.new,
          }
          onUpdate(update)
        } catch (error) {
          console.error('Error processing rift update:', error, payload)
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to rift ${riftId}`)
      } else if (status === 'CHANNEL_ERROR') {
        // Silently handle realtime errors - these are non-critical
        console.debug('Realtime rift subscription error (non-critical):', err?.message || 'Unknown error')
        if (onError) {
          onError(new Error('Realtime sync unavailable'))
        }
      }
    })

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

