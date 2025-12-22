import { EscrowStatus } from '@prisma/client'

/**
 * Validates rift status transitions
 * Returns true if the transition is allowed, false otherwise
 */
export function canTransition(
  currentStatus: EscrowStatus,
  newStatus: EscrowStatus,
  actorRole: 'BUYER' | 'SELLER' | 'ADMIN'
): boolean {
  // Admin can resolve disputes
  if (actorRole === 'ADMIN' && currentStatus === 'DISPUTED') {
    return newStatus === 'RELEASED' || newStatus === 'REFUNDED'
  }

  // State machine transitions - New system (FUNDED, PROOF_SUBMITTED, UNDER_REVIEW)
  switch (currentStatus) {
    // New status system
    case 'DRAFT':
      // Buyer can pay (FUNDED) or cancel
      if (actorRole === 'BUYER') {
        return newStatus === 'FUNDED' || newStatus === 'CANCELED'
      }
      return false

    case 'FUNDED':
      // Seller can submit proof, buyer can dispute or cancel
      if (actorRole === 'SELLER') {
        return newStatus === 'PROOF_SUBMITTED'
      }
      if (actorRole === 'BUYER') {
        return newStatus === 'DISPUTED' || newStatus === 'CANCELED'
      }
      return false

    case 'PROOF_SUBMITTED':
      // Admin can review (UNDER_REVIEW), buyer can release or dispute
      if (actorRole === 'ADMIN') {
        return newStatus === 'UNDER_REVIEW' || newStatus === 'RELEASED'
      }
      if (actorRole === 'BUYER') {
        return newStatus === 'RELEASED' || newStatus === 'DISPUTED'
      }
      return false

    case 'UNDER_REVIEW':
      // Buyer can release or dispute, admin can release
      if (actorRole === 'BUYER') {
        return newStatus === 'RELEASED' || newStatus === 'DISPUTED'
      }
      if (actorRole === 'ADMIN') {
        return newStatus === 'RELEASED'
      }
      return false

    case 'DISPUTED':
      // Only admin can resolve
      return actorRole === 'ADMIN' && (newStatus === 'RELEASED' || newStatus === 'REFUNDED' || newStatus === 'RESOLVED')

    case 'RESOLVED':
      // Admin can finalize resolution
      if (actorRole === 'ADMIN') {
        return newStatus === 'RELEASED' || newStatus === 'REFUNDED'
      }
      return false

    case 'RELEASED':
      // Can transition to payout scheduled
      return newStatus === 'PAYOUT_SCHEDULED'

    case 'PAYOUT_SCHEDULED':
      // Terminal state after payout
      return newStatus === 'PAID_OUT'

    case 'PAID_OUT':
    case 'REFUNDED':
    case 'CANCELED':
    case 'CANCELLED':
      // Terminal states - no transitions allowed
      return false

    // Legacy statuses (for backward compatibility during migration)
    case 'AWAITING_PAYMENT':
      // Map to new system: AWAITING_PAYMENT -> FUNDED
      if (actorRole === 'BUYER') {
        return newStatus === 'FUNDED' || newStatus === 'CANCELED' || newStatus === 'CANCELLED'
      }
      return false

    case 'AWAITING_SHIPMENT':
      // Map to new system: AWAITING_SHIPMENT -> PROOF_SUBMITTED
      if (actorRole === 'SELLER') {
        return newStatus === 'PROOF_SUBMITTED'
      }
      if (actorRole === 'BUYER') {
        return newStatus === 'CANCELED' || newStatus === 'CANCELLED'
      }
      return false

    case 'IN_TRANSIT':
      // Map to new system: IN_TRANSIT -> PROOF_SUBMITTED or UNDER_REVIEW
      if (actorRole === 'BUYER') {
        return newStatus === 'UNDER_REVIEW' || newStatus === 'RELEASED' || newStatus === 'DISPUTED'
      }
      return false

    case 'DELIVERED_PENDING_RELEASE':
      // Map to new system: DELIVERED_PENDING_RELEASE -> RELEASED
      if (actorRole === 'BUYER') {
        return newStatus === 'RELEASED' || newStatus === 'DISPUTED'
      }
      return false

    default:
      return false
  }
}

/**
 * Gets the actor role for a user in an rift transaction
 */
export function getUserRole(
  userId: string,
  buyerId: string,
  sellerId: string,
  userRole: 'USER' | 'ADMIN'
): 'BUYER' | 'SELLER' | 'ADMIN' | null {
  if (userRole === 'ADMIN') return 'ADMIN'
  if (userId === buyerId) return 'BUYER'
  if (userId === sellerId) return 'SELLER'
  return null
}

