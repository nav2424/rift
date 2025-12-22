/**
 * Risk Metrics Updates
 * 
 * Updates risk_profiles based on events (payment success, dispute submitted/resolved, chargebacks, etc.)
 */

import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { ensureRiskProfile, updateUserRiskScores } from './computeRisk'
import { evaluateEnforcement } from './enforcement'

// ============================================
// METRICS UPDATES
// ============================================

/**
 * Update risk metrics when funds are released (successful transaction)
 * Increments successful_transactions and total_volume for both buyer and seller
 */
export async function updateMetricsOnFundsReleased(
  riftId: string,
  buyerId: string,
  sellerId: string,
  amount: number
): Promise<void> {
  const supabase = createServerClient()
  const amountCents = Math.round(amount * 100)

  // Update buyer profile
  const buyerProfile = await ensureRiskProfile(buyerId)
  await supabase
    .from('risk_profiles')
    .update({
      successful_transactions: buyerProfile.successful_transactions + 1,
      total_volume_cents: buyerProfile.total_volume_cents + amountCents,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', buyerId)

  // Update seller profile
  const sellerProfile = await ensureRiskProfile(sellerId)
  await supabase
    .from('risk_profiles')
    .update({
      successful_transactions: sellerProfile.successful_transactions + 1,
      total_volume_cents: sellerProfile.total_volume_cents + amountCents,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', sellerId)

  // Recompute risk scores
  await updateUserRiskScores(buyerId)
  await updateUserRiskScores(sellerId)
}

/**
 * Update risk metrics when dispute is submitted
 * Increments disputes_opened for buyer and updates last_dispute_at
 */
export async function updateMetricsOnDisputeSubmitted(
  buyerId: string
): Promise<void> {
  const supabase = createServerClient()

  const profile = await ensureRiskProfile(buyerId)
  await supabase
    .from('risk_profiles')
    .update({
      disputes_opened: profile.disputes_opened + 1,
      last_dispute_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', buyerId)

  // Recompute risk score
  await updateUserRiskScores(buyerId)

  // Evaluate enforcement (may trigger restrictions)
  await evaluateEnforcement(buyerId)
}

/**
 * Update risk metrics when dispute is resolved
 * 
 * If buyer loses (resolved_seller / auto_rejected / rejected):
 * - buyer.disputes_lost++
 * - optionally strike after repeated losses
 * 
 * If seller loses (resolved_buyer):
 * - seller.strikes++ (seller performance issue)
 */
export async function updateMetricsOnDisputeResolved(
  disputeId: string,
  riftId: string,
  buyerId: string,
  sellerId: string,
  resolution: 'resolved_buyer' | 'resolved_seller' | 'auto_rejected' | 'rejected'
): Promise<void> {
  const supabase = createServerClient()

  if (resolution === 'resolved_buyer') {
    // Seller lost - add strike
    const sellerProfile = await ensureRiskProfile(sellerId)
    await supabase
      .from('risk_profiles')
      .update({
        strikes: sellerProfile.strikes + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', sellerId)

    // Log enforcement action
    await supabase.from('enforcement_actions').insert({
      user_id: sellerId,
      action_type: 'strike',
      reason: `Dispute resolved in favor of buyer (dispute ${disputeId})`,
      meta: { disputeId, riftId, resolution },
    })

    await updateUserRiskScores(sellerId)
    await evaluateEnforcement(sellerId)
  } else {
    // Buyer lost (resolved_seller, auto_rejected, rejected)
    const buyerProfile = await ensureRiskProfile(buyerId)
    await supabase
      .from('risk_profiles')
      .update({
        disputes_lost: buyerProfile.disputes_lost + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', buyerId)

    await updateUserRiskScores(buyerId)
    await evaluateEnforcement(buyerId)
  }
}

/**
 * Update risk metrics when chargeback is detected
 * Increments chargebacks and sets last_chargeback_at for buyer
 * Triggers immediate freeze and ban evaluation
 */
export async function updateMetricsOnChargeback(
  buyerId: string,
  amount: number
): Promise<void> {
  const supabase = createServerClient()

  const profile = await ensureRiskProfile(buyerId)
  await supabase
    .from('risk_profiles')
    .update({
      chargebacks: profile.chargebacks + 1,
      last_chargeback_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', buyerId)

  // Recompute risk score
  await updateUserRiskScores(buyerId)

  // Evaluate enforcement (will freeze funds and potentially ban)
  await evaluateEnforcement(buyerId)
}

