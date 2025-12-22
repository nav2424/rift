/**
 * Policy Acceptance Capture
 * 
 * Captures user acceptance of Terms of Service, Privacy Policy, etc.
 * at key moments (signup, checkout, payouts).
 */

import { createServerClient } from '@/lib/supabase'
import { logEvent } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'
import crypto from 'crypto'

// Policy version from environment or config
const POLICY_VERSION = process.env.POLICY_VERSION || '2025-01-17_v1'

/**
 * Hash IP address for privacy (same strategy as Phase 1)
 */
function hashIP(ip: string | undefined): string | null {
  if (!ip) return null
  
  const salt = process.env.IP_HASH_SALT || 'rift-ip-salt-change-in-production'
  return crypto.createHash('sha256').update(ip + salt).digest('hex')
}

/**
 * Capture policy acceptance
 */
export async function capturePolicyAcceptance(
  userId: string,
  context: 'signup' | 'checkout' | 'payouts' | 'other',
  requestMeta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const supabase = createServerClient()
  
  const ipHash = requestMeta?.ip ? hashIP(requestMeta.ip) : null

  await supabase.from('policy_acceptances').insert({
    user_id: userId,
    context,
    policy_version: POLICY_VERSION,
    ip_hash: ipHash,
    user_agent: requestMeta?.userAgent || null,
    meta: {},
  })

  // Log event (for signup/checkout contexts, we may not have a riftId)
  // For system-level events without a rift, we'll skip rift_events
  // and rely on policy_acceptances table for audit trail
  if (context === 'checkout') {
    // Checkout acceptance will be logged with the rift when payment succeeds
    // We'll handle that in the payment webhook
  } else {
    // For signup and other contexts, we can log a system event
    // But since logEvent requires a riftId, we'll skip it for now
    // The policy_acceptances table provides the audit trail
  }
}

/**
 * Get policy acceptances for a user
 */
export async function getUserPolicyAcceptances(
  userId: string,
  context?: 'signup' | 'checkout' | 'payouts' | 'other'
): Promise<any[]> {
  const supabase = createServerClient()
  
  let query = supabase
    .from('policy_acceptances')
    .select('*')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false })

  if (context) {
    query = query.eq('context', context)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching policy acceptances:', error)
    return []
  }

  return data || []
}

/**
 * Get latest policy acceptance for a user in a specific context
 */
export async function getLatestPolicyAcceptance(
  userId: string,
  context: 'signup' | 'checkout' | 'payouts' | 'other'
): Promise<any | null> {
  const acceptances = await getUserPolicyAcceptances(userId, context)
  return acceptances.length > 0 ? acceptances[0] : null
}

