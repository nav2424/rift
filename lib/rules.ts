type EscrowStatus = 
  | 'AWAITING_PAYMENT'
  | 'AWAITING_SHIPMENT'
  | 'IN_TRANSIT'
  | 'DELIVERED_PENDING_RELEASE'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'CANCELLED'

/**
 * Validates escrow status transitions
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

  // State machine transitions
  switch (currentStatus) {
    case 'AWAITING_PAYMENT':
      // Buyer can mark as paid or cancel
      if (actorRole === 'BUYER') {
        return newStatus === 'AWAITING_SHIPMENT' || newStatus === 'CANCELLED'
      }
      return false

    case 'AWAITING_SHIPMENT':
      // Seller can upload proof (IN_TRANSIT) or buyer/seller can cancel
      if (actorRole === 'SELLER') {
        return newStatus === 'IN_TRANSIT'
      }
      if (actorRole === 'BUYER') {
        return newStatus === 'CANCELLED'
      }
      return false

    case 'IN_TRANSIT':
      // Buyer can confirm receipt, raise dispute, or for non-physical items, release funds early
      if (actorRole === 'BUYER') {
        // For non-physical items, buyer can release funds directly (early release)
        // This is handled by the release-funds endpoint, not through standard transitions
        // Standard transition: IN_TRANSIT -> DELIVERED_PENDING_RELEASE or DISPUTED
        return newStatus === 'DELIVERED_PENDING_RELEASE' || newStatus === 'DISPUTED'
      }
      return false

    case 'DELIVERED_PENDING_RELEASE':
      // Buyer can release funds or raise dispute
      if (actorRole === 'BUYER') {
        return newStatus === 'RELEASED' || newStatus === 'DISPUTED'
      }
      return false

    case 'DISPUTED':
      // Only admin can resolve
      return actorRole === 'ADMIN' && (newStatus === 'RELEASED' || newStatus === 'REFUNDED')

    case 'RELEASED':
    case 'REFUNDED':
    case 'CANCELLED':
      // Terminal states - no transitions allowed
      return false

    default:
      return false
  }
}

/**
 * Gets the actor role for a user in an escrow transaction
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

