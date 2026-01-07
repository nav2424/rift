/**
 * Refund Policy Enforcement
 * 
 * Implements Policy 1: "No refunds after release"
 * Once a milestone is released, it's final.
 * Refunds are only possible for unreleased milestones.
 */

import { prisma } from './prisma'

export interface RefundEligibility {
  eligible: boolean
  reason?: string
  unreleasedAmount: number
  releasedAmount: number
  canRefundFull: boolean
  canRefundPartial: boolean
  maxRefundAmount: number
}

/**
 * Check if a rift is eligible for refund
 * Policy: No refunds after any release (full or milestone)
 */
export async function checkRefundEligibility(
  riftId: string
): Promise<RefundEligibility> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: {
      MilestoneRelease: {
        where: { status: 'RELEASED' },
      },
    },
  })

  if (!rift) {
    return {
      eligible: false,
      reason: 'Rift not found',
      unreleasedAmount: 0,
      releasedAmount: 0,
      canRefundFull: false,
      canRefundPartial: false,
      maxRefundAmount: 0,
    }
  }

  // Check if rift is fully released
  if (rift.status === 'RELEASED') {
    return {
      eligible: false,
      reason: 'Rift is fully released. No refunds allowed after release.',
      unreleasedAmount: 0,
      releasedAmount: rift.subtotal || 0,
      canRefundFull: false,
      canRefundPartial: false,
      maxRefundAmount: 0,
    }
  }

  // Check if any milestones have been released
  const releasedMilestones = rift.MilestoneRelease || []
  const totalReleased = releasedMilestones.reduce(
    (sum, release) => sum + (release.releasedAmount || 0),
    0
  )

  if (totalReleased > 0) {
    // Some milestones released - can only refund unreleased portion
    const subtotal = rift.subtotal || 0
    const unreleasedAmount = subtotal - totalReleased
    const buyerTotal = subtotal + (rift.buyerFee || 0)

    return {
      eligible: unreleasedAmount > 0,
      reason: unreleasedAmount > 0
        ? `Partial refund allowed for unreleased amount: ${rift.currency} ${unreleasedAmount.toFixed(2)}`
        : 'All milestones have been released. No refunds allowed.',
      unreleasedAmount,
      releasedAmount: totalReleased,
      canRefundFull: false, // Can't refund full if any milestone released
      canRefundPartial: unreleasedAmount > 0,
      maxRefundAmount: unreleasedAmount + (rift.buyerFee || 0), // Can refund unreleased + buyer fee
    }
  }

  // No releases yet - can refund full amount
  const buyerTotal = (rift.subtotal || 0) + (rift.buyerFee || 0)

  return {
    eligible: true,
    reason: 'Full refund allowed - no releases yet',
    unreleasedAmount: rift.subtotal || 0,
    releasedAmount: 0,
    canRefundFull: true,
    canRefundPartial: true,
    maxRefundAmount: buyerTotal,
  }
}

/**
 * Validate refund amount against policy
 */
export async function validateRefundAmount(
  riftId: string,
  refundAmount: number
): Promise<{ valid: boolean; error?: string; maxAmount?: number }> {
  const eligibility = await checkRefundEligibility(riftId)

  if (!eligibility.eligible) {
    return {
      valid: false,
      error: eligibility.reason || 'Refund not eligible',
    }
  }

  if (refundAmount > eligibility.maxRefundAmount) {
    return {
      valid: false,
      error: `Refund amount exceeds maximum allowed: ${eligibility.maxRefundAmount.toFixed(2)}`,
      maxAmount: eligibility.maxRefundAmount,
    }
  }

  if (refundAmount <= 0) {
    return {
      valid: false,
      error: 'Refund amount must be greater than zero',
    }
  }

  return { valid: true }
}


