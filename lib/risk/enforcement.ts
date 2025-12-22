/**
 * Enforcement Engine - Automatic Abuse Controls
 * 
 * Evaluates user behavior and applies automatic enforcement actions
 * including strikes, restrictions, and fund freezing.
 */

import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { logEvent } from '@/lib/rift-events'
// RiftEventActorType not needed here - system events logged to enforcement_actions
import { getRiskProfile, ensureRiskProfile } from './computeRisk'

// ============================================
// ENFORCEMENT EVALUATION
// ============================================

export interface EnforcementAction {
  action_type: 'strike' | 'require_confirmation' | 'extend_hold' | 'freeze_funds' | 'restrict_disputes' | 'restrict_category' | 'ban'
  reason: string
  meta?: Record<string, any>
}

/**
 * Evaluate and apply enforcement actions for a user
 * Returns list of actions that were applied
 */
export async function evaluateEnforcement(userId: string): Promise<EnforcementAction[]> {
  const profile = await ensureRiskProfile(userId)
  const supabase = createServerClient()
  const actions: EnforcementAction[] = []

  // Rule 1: Chargeback >= 1 → Freeze funds + Ban evaluation
  if (profile.chargebacks >= 1) {
    // Freeze funds
    await supabase.from('user_restrictions').upsert({
      user_id: userId,
      funds_frozen: true,
      frozen_reason: `Chargeback detected (${profile.chargebacks} total)`,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    })

    await supabase.from('enforcement_actions').insert({
      user_id: userId,
      action_type: 'freeze_funds',
      reason: `Chargeback detected (${profile.chargebacks} total)`,
      meta: { chargebacks: profile.chargebacks },
    })

    actions.push({
      action_type: 'freeze_funds',
      reason: `Chargeback detected (${profile.chargebacks} total)`,
      meta: { chargebacks: profile.chargebacks },
    })

    // Note: System-level events are logged to enforcement_actions table
    // rift_events requires a valid riftId, so we skip logging here

    // Consider ban for multiple chargebacks
    if (profile.chargebacks >= 2) {
      await supabase.from('enforcement_actions').insert({
        user_id: userId,
        action_type: 'ban',
        reason: `Multiple chargebacks (${profile.chargebacks}) - account banned`,
        meta: { chargebacks: profile.chargebacks },
      })

      actions.push({
        action_type: 'ban',
        reason: `Multiple chargebacks (${profile.chargebacks}) - account banned`,
        meta: { chargebacks: profile.chargebacks },
      })

      // Note: System-level events are logged to enforcement_actions table
    }
  }

  // Rule 2: Buyer dispute abuse
  // If disputes_opened >= 5 and disputes_lost/disputes_opened >= 0.6
  if (profile.disputes_opened >= 5) {
    const disputeRatio = profile.disputes_lost / profile.disputes_opened
    if (disputeRatio >= 0.6) {
      // Restrict disputes for 30 days
      const restrictedUntil = new Date()
      restrictedUntil.setDate(restrictedUntil.getDate() + 30)

      await supabase.from('user_restrictions').upsert({
        user_id: userId,
        disputes_restricted_until: restrictedUntil.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

      await supabase.from('enforcement_actions').insert({
        user_id: userId,
        action_type: 'restrict_disputes',
        reason: `Dispute abuse detected: ${profile.disputes_opened} opened, ${profile.disputes_lost} lost (${(disputeRatio * 100).toFixed(1)}% loss rate)`,
        meta: {
          disputes_opened: profile.disputes_opened,
          disputes_lost: profile.disputes_lost,
          ratio: disputeRatio,
          restricted_until: restrictedUntil.toISOString(),
        },
      })

      // Add strike
      await supabase
        .from('risk_profiles')
        .update({
          strikes: profile.strikes + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      await supabase.from('enforcement_actions').insert({
        user_id: userId,
        action_type: 'strike',
        reason: 'Dispute abuse',
        meta: { disputes_opened: profile.disputes_opened, disputes_lost: profile.disputes_lost },
      })

      actions.push({
        action_type: 'restrict_disputes',
        reason: `Dispute abuse detected: ${profile.disputes_opened} opened, ${profile.disputes_lost} lost`,
        meta: { disputes_opened: profile.disputes_opened, disputes_lost: profile.disputes_lost },
      })

      actions.push({
        action_type: 'strike',
        reason: 'Dispute abuse',
        meta: { disputes_opened: profile.disputes_opened, disputes_lost: profile.disputes_lost },
      })

      // Note: System-level events are logged to enforcement_actions table
    }
  }

  // Rule 3: Seller non-delivery / dispute losses
  // If seller has disputes_lost >= 3 in last 60 days
  // For now, use total disputes_lost as proxy (we'll refine this with proper query later)
  // Note: We'd need to join disputes with rifts to get sellerId, but for MVP we use total count
  if (profile.disputes_lost >= 3) {
    // Block tickets category first
    const { data: restrictions } = await supabase
      .from('user_restrictions')
      .select('categories_blocked')
      .eq('user_id', userId)
      .maybeSingle()

    const currentBlocked = restrictions?.categories_blocked || []
    if (!currentBlocked.includes('TICKETS')) {
      const newBlocked = [...currentBlocked, 'TICKETS']

      await supabase.from('user_restrictions').upsert({
        user_id: userId,
        categories_blocked: newBlocked,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

      await supabase.from('enforcement_actions').insert({
        user_id: userId,
        action_type: 'restrict_category',
        reason: `Seller performance: ${profile.disputes_lost} disputes lost - tickets category blocked`,
        meta: { categories: ['TICKETS'], disputes_lost: profile.disputes_lost },
      })

      actions.push({
        action_type: 'restrict_category',
        reason: `Seller performance: ${profile.disputes_lost} disputes lost - tickets category blocked`,
        meta: { categories: ['TICKETS'] },
      })

      // Note: System-level events are logged to enforcement_actions table
    }
  }

  return actions
}

/**
 * Check if user has funds frozen
 */
export async function isFundsFrozen(userId: string): Promise<boolean> {
  const supabase = createServerClient()
  
  const { data } = await supabase
    .from('user_restrictions')
    .select('funds_frozen')
    .eq('user_id', userId)
    .maybeSingle()

  return data?.funds_frozen || false
}

/**
 * Check if user is restricted from opening disputes
 */
export async function isDisputesRestricted(userId: string): Promise<{ restricted: boolean; until?: Date }> {
  const supabase = createServerClient()
  
  const { data } = await supabase
    .from('user_restrictions')
    .select('disputes_restricted_until')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data?.disputes_restricted_until) {
    return { restricted: false }
  }

  const until = new Date(data.disputes_restricted_until)
  const now = new Date()

  return {
    restricted: until > now,
    until: until > now ? until : undefined,
  }
}

/**
 * Check if user is blocked from a category
 */
export async function isCategoryBlocked(userId: string, category: string): Promise<boolean> {
  const supabase = createServerClient()
  
  const { data } = await supabase
    .from('user_restrictions')
    .select('categories_blocked')
    .eq('user_id', userId)
    .maybeSingle()

  const blocked = data?.categories_blocked || []
  return blocked.includes(category.toUpperCase())
}

