/**
 * State machine for Rift transactions
 * Enforces strict state transitions
 */

import { EscrowStatus } from '@prisma/client'

const VALID_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  DRAFT: ['FUNDED', 'CANCELED'],
  FUNDED: ['PROOF_SUBMITTED', 'DISPUTED', 'CANCELED'],
  PROOF_SUBMITTED: ['UNDER_REVIEW', 'RELEASED', 'DISPUTED'],
  UNDER_REVIEW: ['PROOF_SUBMITTED', 'RELEASED', 'DISPUTED'],
  RELEASED: ['PAYOUT_SCHEDULED'],
  DISPUTED: ['RESOLVED'],
  RESOLVED: ['RELEASED', 'PAYOUT_SCHEDULED', 'CANCELED'],
  PAYOUT_SCHEDULED: ['PAID_OUT'],
  PAID_OUT: [],
  CANCELED: [],
  // Legacy statuses
  AWAITING_PAYMENT: ['FUNDED', 'CANCELED'],
  AWAITING_SHIPMENT: ['PROOF_SUBMITTED', 'DISPUTED'],
  IN_TRANSIT: ['PROOF_SUBMITTED', 'RELEASED', 'DISPUTED'],
  DELIVERED_PENDING_RELEASE: ['RELEASED', 'DISPUTED'],
  REFUNDED: [],
  CANCELLED: ['CANCELED'],
}

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  from: EscrowStatus,
  to: EscrowStatus
): boolean {
  const validNextStates = VALID_TRANSITIONS[from] || []
  return validNextStates.includes(to)
}

/**
 * Validate state transition and throw if invalid
 */
export function validateTransition(
  from: EscrowStatus,
  to: EscrowStatus
): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid state transition from ${from} to ${to}. Valid transitions: ${VALID_TRANSITIONS[from]?.join(', ') || 'none'}`
    )
  }
}

/**
 * Get valid next states for a given state
 */
export function getValidNextStates(current: EscrowStatus): EscrowStatus[] {
  return VALID_TRANSITIONS[current] || []
}

/**
 * Check if buyer can dispute in current state
 */
export function canBuyerDispute(status: EscrowStatus): boolean {
  return ['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(status)
}

/**
 * Check if seller can submit proof in current state
 * Allows submission when:
 * - Status is FUNDED (initial proof submission)
 * - Status is UNDER_REVIEW (resubmission after rejection)
 */
export function canSellerSubmitProof(status: EscrowStatus): boolean {
  return status === 'FUNDED' || status === 'UNDER_REVIEW'
}

/**
 * Check if buyer can release in current state
 */
export function canBuyerRelease(status: EscrowStatus): boolean {
  return ['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(status)
}

/**
 * Check if auto-release can trigger in current state
 */
export function canAutoRelease(status: EscrowStatus): boolean {
  return ['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(status)
}
