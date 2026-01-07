/**
 * Risk Engine - Deterministic and Explainable Risk Scoring
 * 
 * Computes user risk scores, rift risk scores, and applies risk policies
 * to determine hold durations, confirmation requirements, and review flags.
 */

import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { logEvent } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'

// ============================================
// TYPES
// ============================================

export interface RiskProfile {
  user_id: string
  buyer_risk_score: number
  seller_risk_score: number
  strikes: number
  chargebacks: number
  disputes_opened: number
  disputes_lost: number
  successful_transactions: number
  total_volume_cents: number
  last_chargeback_at: Date | null
  last_dispute_at: Date | null
}

export interface RiskPolicy {
  hold_until: Date | null
  requires_buyer_confirmation: boolean
  requires_manual_review: boolean
}

// ============================================
// RISK PROFILE MANAGEMENT
// ============================================

/**
 * Ensure a risk profile exists for a user (upsert if missing)
 */
export async function ensureRiskProfile(userId: string): Promise<RiskProfile> {
  const supabase = createServerClient()
  
  // Check if profile exists
  const { data: existing } = await supabase
    .from('risk_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    return existing as RiskProfile
  }

  // Create new profile
  const { data: newProfile, error } = await supabase
    .from('risk_profiles')
    .insert({
      user_id: userId,
      buyer_risk_score: 0,
      seller_risk_score: 0,
      strikes: 0,
      chargebacks: 0,
      disputes_opened: 0,
      disputes_lost: 0,
      successful_transactions: 0,
      total_volume_cents: 0,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create risk profile: ${error.message}`)
  }

  return newProfile as RiskProfile
}

/**
 * Get risk profile for a user
 */
export async function getRiskProfile(userId: string): Promise<RiskProfile | null> {
  const supabase = createServerClient()
  
  const { data, error } = await supabase
    .from('risk_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching risk profile:', error)
    return null
  }

  return data as RiskProfile | null
}

// ============================================
// USER RISK COMPUTATION
// ============================================

/**
 * Compute user risk score (0-100) for buyer or seller role
 * 
 * Scoring rules:
 * - Base: 10
 * - +40 if chargebacks >= 1
 * - +15 if disputes_lost / max(1, disputes_opened) > 0.5 and disputes_opened >= 3
 * - +10 if strikes >= 3
 * - +10 if account age < 14 days
 * - -10 if successful_transactions >= 10
 * - -10 if total_volume_cents >= 500000 (5k)
 */
export async function computeUserRisk(
  userId: string,
  role: 'buyer' | 'seller'
): Promise<number> {
  const profile = await ensureRiskProfile(userId)
  
  // Get account age (from user creation date)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  }).catch(() => null)

  const accountAgeDays = user
    ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // Start with base score
  let score = 10

  // Chargeback penalty (severe)
  if (profile.chargebacks >= 1) {
    score += 40
  }

  // Dispute abuse penalty
  const disputeRatio = profile.disputes_opened > 0
    ? profile.disputes_lost / profile.disputes_opened
    : 0
  if (disputeRatio > 0.5 && profile.disputes_opened >= 3) {
    score += 15
  }

  // Strike penalty
  if (profile.strikes >= 3) {
    score += 10
  }

  // New account penalty
  if (accountAgeDays < 14) {
    score += 10
  }

  // Positive signals (reduce risk)
  if (profile.successful_transactions >= 10) {
    score -= 10
  }

  if (profile.total_volume_cents >= 500000) { // $5k
    score -= 10
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score))
}

/**
 * Update user risk scores in risk_profiles table
 */
export async function updateUserRiskScores(userId: string): Promise<void> {
  const buyerRisk = await computeUserRisk(userId, 'buyer')
  const sellerRisk = await computeUserRisk(userId, 'seller')

  const supabase = createServerClient()
  
  await supabase
    .from('risk_profiles')
    .update({
      buyer_risk_score: buyerRisk,
      seller_risk_score: sellerRisk,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}

// ============================================
// RIFT RISK COMPUTATION
// ============================================

/**
 * Compute rift risk score (0-100) based on category, amount, and user risks
 * 
 * Category weights:
 * - OWNERSHIP_TRANSFER: +20
 * - DIGITAL: +10
 * - SERVICES: +5
 * - PHYSICAL: +0
 * 
 * Amount weights:
 * - < $50: +0
 * - $50-$200: +5
 * - $200-$1000: +10
 * - > $1000: +20
 * 
 * User risk influence:
 * - risk = category + amount + (buyerRisk * 0.4) + (sellerRisk * 0.4)
 */
export async function computeRiftRisk(riftId: string): Promise<number> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      id: true,
      itemType: true,
      subtotal: true,
      buyerId: true,
      sellerId: true,
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  // Get user risk scores
  const buyerProfile = await getRiskProfile(rift.buyerId)
  const sellerProfile = await getRiskProfile(rift.sellerId)

  const buyerRisk = buyerProfile?.buyer_risk_score || 0
  const sellerRisk = sellerProfile?.seller_risk_score || 0

  // Category weight
  let categoryWeight = 0
  switch (rift.itemType) {
    case 'OWNERSHIP_TRANSFER':
      categoryWeight = 20
      break
    case 'DIGITAL_GOODS':
      categoryWeight = 10
      break
    case 'SERVICES':
      categoryWeight = 5
      break
    case 'PHYSICAL':
    default:
      categoryWeight = 0
      break
  }

  // Amount weight (convert to cents for comparison)
  const amountCents = Math.round((rift.subtotal || 0) * 100)
  let amountWeight = 0
  if (amountCents >= 100000) { // >= $1000
    amountWeight = 20
  } else if (amountCents >= 20000) { // >= $200
    amountWeight = 10
  } else if (amountCents >= 5000) { // >= $50
    amountWeight = 5
  }

  // Compute base risk
  let risk = categoryWeight + amountWeight + (buyerRisk * 0.4) + (sellerRisk * 0.4)

  // Enhanced AI Fraud Detection
  try {
    const { computeEnhancedRiskScore } = await import('@/lib/ai/fraud-detection')
    const enhanced = await computeEnhancedRiskScore(
      rift.buyerId,
      riftId,
      risk,
      undefined // Will compute fraud signals internally
    )
    risk = enhanced.enhancedRiskScore
  } catch (error) {
    console.error('AI fraud detection failed:', error)
    // Continue with base risk if AI fails
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(risk)))
}

// ============================================
// RISK POLICY APPLICATION
// ============================================

/**
 * Apply risk policy to a rift based on its risk score
 * 
 * Policy tiers:
 * - 0-29 (low): hold_until = now + 24h, no confirmation required
 * - 30-59 (medium): hold_until = now + 72h, confirmation required
 * - 60-79 (high): hold_until = now + 7 days, confirmation + manual review for tickets/high amounts
 * - 80-100 (critical): freeze funds OR require manual approval, hold_until = now + 14 days or null
 */
export async function applyRiskPolicy(riftId: string): Promise<RiskPolicy> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      id: true,
      itemType: true,
      subtotal: true,
      riskScore: true,
      buyerId: true,
      sellerId: true,
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  // Compute or use existing risk score
  const riskScore = rift.riskScore > 0 ? rift.riskScore : await computeRiftRisk(riftId)

  // Update rift with computed risk score
  if (rift.riskScore !== riskScore) {
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: { riskScore },
    })
  }

  const now = new Date()
  let policy: RiskPolicy

  if (riskScore >= 80) {
    // Critical risk
    policy = {
      hold_until: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
      requires_buyer_confirmation: true,
      requires_manual_review: true,
    }
  } else if (riskScore >= 60) {
    // High risk
    const needsManualReview = rift.itemType === 'OWNERSHIP_TRANSFER' || (rift.subtotal || 0) >= 1000
    policy = {
      hold_until: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
      requires_buyer_confirmation: true,
      requires_manual_review: needsManualReview,
    }
  } else if (riskScore >= 30) {
    // Medium risk
    policy = {
      hold_until: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 72 hours
      requires_buyer_confirmation: true,
      requires_manual_review: false,
    }
  } else {
    // Low risk
    // For services/digital (except tickets), no confirmation needed
    const needsConfirmation = rift.itemType === 'OWNERSHIP_TRANSFER' || rift.itemType === 'PHYSICAL'
    policy = {
      hold_until: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
      requires_buyer_confirmation: needsConfirmation,
      requires_manual_review: false,
    }
  }

  // Apply policy to rift
  await prisma.riftTransaction.update({
    where: { id: riftId },
    data: {
      holdUntil: policy.hold_until || undefined,
      requiresBuyerConfirmation: policy.requires_buyer_confirmation,
      requiresManualReview: policy.requires_manual_review,
    },
  })

  // Get user risk scores for logging
  const buyerProfile = await getRiskProfile(rift.buyerId)
  const sellerProfile = await getRiskProfile(rift.sellerId)

  // Log risk scoring event
  await logEvent(
    riftId,
    RiftEventActorType.SYSTEM,
    null,
    'RISK_SCORED',
    {
      risk_score: riskScore,
      buyerRisk: buyerProfile?.buyer_risk_score || 0,
      sellerRisk: sellerProfile?.seller_risk_score || 0,
      policy: {
        hold_until: policy.hold_until?.toISOString() || null,
        requires_buyer_confirmation: policy.requires_buyer_confirmation,
        requires_manual_review: policy.requires_manual_review,
      },
    },
    undefined
  )

  // Create enforcement actions if needed
  const supabase = createServerClient()
  
  if (policy.requires_buyer_confirmation) {
    await supabase.from('enforcement_actions').insert({
      user_id: rift.buyerId,
      action_type: 'require_confirmation',
      reason: `Risk score ${riskScore} requires buyer confirmation`,
      meta: { riftId, riskScore },
    })
  }

  if (policy.requires_manual_review) {
      await supabase.from('enforcement_actions').insert({
        user_id: rift.sellerId,
        action_type: 'extend_hold',
        reason: `Risk score ${riskScore} requires manual admin review`,
        meta: { riftId, riskScore, hold_until: policy.hold_until?.toISOString() || null },
      })
  }

  if (riskScore >= 80) {
    // Critical risk - consider freezing funds
    await supabase.from('enforcement_actions').insert({
      user_id: rift.sellerId,
      action_type: 'freeze_funds',
      reason: `Critical risk score ${riskScore} - funds may be frozen pending review`,
      meta: { riftId, riskScore },
    })
  }

  return policy
}

