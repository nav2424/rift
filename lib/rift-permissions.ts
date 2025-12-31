/**
 * State-based action permissions for Rift transactions
 * Defines what buyers, sellers, and admins can do in each state
 */

import { EscrowStatus } from '@prisma/client'

export type ActorRole = 'BUYER' | 'SELLER' | 'ADMIN' | 'SYSTEM'

export type RiftAction =
  | 'EDIT_RIFT_DETAILS'
  | 'CANCEL_RIFT'
  | 'INVITE_SELLER'
  | 'CHANGE_SELLER'
  | 'CHAT'
  | 'UPLOAD_FINAL_PROOF'
  | 'OPEN_DISPUTE'
  | 'VIEW_FUNDED_STATUS'
  | 'VIEW_TIMELINE'
  | 'REQUEST_UPDATE'
  | 'CANCEL_REQUEST'
  | 'UPLOAD_PROOF'
  | 'ADD_DELIVERY_NOTES'
  | 'START_FULFILLMENT_TIMER'
  | 'ACCESS_VAULT'
  | 'OPEN_PROOF'
  | 'REVEAL_LICENSE_KEY'
  | 'DOWNLOAD_FILE'
  | 'ACCEPT_PROOF'
  | 'VIEW_UNDER_REVIEW_STATUS'
  | 'SUBMIT_EXTRA_EVIDENCE'
  | 'SUBMIT_ADDITIONAL_PROOF'
  | 'CLARIFY_PROOF'
  | 'VIEW_FINAL_RECEIPT'
  | 'VIEW_VAULT_LOGS'
  | 'VIEW_PAYOUT_TIMELINE'
  | 'WITHDRAW_FUNDS'
  | 'VIEW_PAYOUT_STATUS'
  | 'SUBMIT_STRUCTURED_CLAIM'
  | 'VIEW_SELLER_RESPONSES'
  | 'SUBMIT_APPEAL'
  | 'SUBMIT_REBUTTAL'
  | 'VIEW_BUYER_CLAIMS'
  | 'VIEW_RECEIPT_LOGS'
  | 'DECLINE_PARTICIPATION'
  | 'AUTO_ROUTE_UNDER_REVIEW'
  | 'APPROVE_PROOF'
  | 'REJECT_PROOF'
  | 'ESCALATE_DISPUTE'
  | 'VIEW_VAULT_ASSETS'
  | 'RESOLVE_DISPUTE'

/**
 * Get allowed actions for a user in a specific Rift state
 */
export function getAllowedActions(
  status: EscrowStatus,
  actorRole: ActorRole
): RiftAction[] {
  const actions: RiftAction[] = []

  switch (status) {
    case 'DRAFT':
      if (actorRole === 'BUYER') {
        actions.push(
          'EDIT_RIFT_DETAILS',
          'CANCEL_RIFT',
          'INVITE_SELLER',
          'CHANGE_SELLER',
          'CHAT'
        )
      }
      if (actorRole === 'SELLER') {
        // Seller can edit only if they're the creator and buyer not yet set OR buyer hasn't funded
        actions.push('EDIT_RIFT_DETAILS', 'DECLINE_PARTICIPATION', 'CHAT')
      }
      // No one can upload final proof or open dispute in DRAFT
      break

    case 'FUNDED':
      // FUNDED means payment has been received - seller can now submit proof
      if (actorRole === 'BUYER') {
        actions.push(
          'VIEW_FUNDED_STATUS',
          'VIEW_TIMELINE',
          'CHAT',
          'REQUEST_UPDATE',
          'CANCEL_REQUEST',
          'OPEN_DISPUTE' // Only if seller is past SLA
        )
      }
      if (actorRole === 'SELLER') {
        actions.push(
          'UPLOAD_PROOF',
          'ADD_DELIVERY_NOTES',
          'START_FULFILLMENT_TIMER',
          'CHAT',
          'OPEN_DISPUTE' // Only for abuse/harassment/off-platform coercion
        )
      }
      break

    case 'PROOF_SUBMITTED':
      if (actorRole === 'BUYER') {
        actions.push(
          'ACCESS_VAULT',
          'OPEN_PROOF',
          'REVEAL_LICENSE_KEY',
          'DOWNLOAD_FILE',
          'ACCEPT_PROOF',
          'OPEN_DISPUTE',
          'CHAT'
        )
      }
      if (actorRole === 'SELLER') {
        actions.push(
          'ADD_DELIVERY_NOTES',
          'SUBMIT_ADDITIONAL_PROOF', // Append-only
          'OPEN_DISPUTE', // Seller can dispute after submitting proof
          'CHAT'
        )
        // Cannot edit/delete submitted proof
      }
      if (actorRole === 'ADMIN' || actorRole === 'SYSTEM') {
        actions.push('AUTO_ROUTE_UNDER_REVIEW') // If risk flags triggered
      }
      break

    case 'UNDER_REVIEW':
      if (actorRole === 'BUYER') {
        actions.push(
          'VIEW_UNDER_REVIEW_STATUS',
          'SUBMIT_EXTRA_EVIDENCE',
          'OPEN_DISPUTE',
          'CHAT'
        )
      }
      if (actorRole === 'SELLER') {
        actions.push(
          'SUBMIT_ADDITIONAL_PROOF',
          'CLARIFY_PROOF',
          'OPEN_DISPUTE', // Seller can dispute while under review
          'CHAT'
        )
      }
      if (actorRole === 'ADMIN') {
        actions.push(
          'APPROVE_PROOF',
          'REJECT_PROOF',
          'ESCALATE_DISPUTE',
          'VIEW_VAULT_ASSETS'
        )
      }
      break

    case 'RELEASED':
      if (actorRole === 'BUYER') {
        actions.push('VIEW_FINAL_RECEIPT', 'VIEW_VAULT_LOGS')
        // No dispute (unless rare fraud escalation, default off)
      }
      if (actorRole === 'SELLER') {
        actions.push('VIEW_PAYOUT_TIMELINE')
        // Withdraw only after payout completes
      }
      break

    case 'PAYOUT_SCHEDULED':
      if (actorRole === 'BUYER' || actorRole === 'SELLER') {
        actions.push('VIEW_PAYOUT_STATUS')
      }
      break

    case 'PAID_OUT':
      if (actorRole === 'BUYER' || actorRole === 'SELLER') {
        actions.push('VIEW_RECEIPT_LOGS')
      }
      break

    case 'DISPUTED':
      if (actorRole === 'BUYER') {
        actions.push(
          'SUBMIT_STRUCTURED_CLAIM',
          'VIEW_SELLER_RESPONSES',
          'SUBMIT_APPEAL',
          'CHAT'
        )
      }
      if (actorRole === 'SELLER') {
        actions.push(
          'SUBMIT_REBUTTAL',
          'VIEW_BUYER_CLAIMS',
          'SUBMIT_APPEAL',
          'CHAT'
        )
      }
      if (actorRole === 'ADMIN') {
        actions.push(
          'RESOLVE_DISPUTE',
          'VIEW_VAULT_ASSETS',
          'VIEW_VAULT_LOGS'
        )
      }
      // System locks all timers, prevents release until resolved
      break

    case 'RESOLVED':
      // Terminal state - outcome transitions handled by system
      if (actorRole === 'BUYER' || actorRole === 'SELLER') {
        actions.push('VIEW_RECEIPT_LOGS')
      }
      break

    case 'CANCELED':
      // Terminal state - no actions beyond viewing
      if (actorRole === 'BUYER' || actorRole === 'SELLER') {
        actions.push('VIEW_RECEIPT_LOGS')
      }
      break

    // Legacy statuses
    case 'AWAITING_PAYMENT':
      // Map to DRAFT behavior
      if (actorRole === 'BUYER') {
        actions.push('EDIT_RIFT_DETAILS', 'CANCEL_RIFT', 'CHAT')
      }
      break

    case 'AWAITING_SHIPMENT':
    case 'IN_TRANSIT':
      // Map to FUNDED behavior
      if (actorRole === 'BUYER') {
        actions.push('VIEW_FUNDED_STATUS', 'VIEW_TIMELINE', 'CHAT', 'OPEN_DISPUTE')
      }
      if (actorRole === 'SELLER') {
        actions.push('UPLOAD_PROOF', 'ADD_DELIVERY_NOTES', 'CHAT')
      }
      break

    case 'DELIVERED_PENDING_RELEASE':
      // Map to PROOF_SUBMITTED behavior
      if (actorRole === 'BUYER') {
        actions.push(
          'ACCESS_VAULT',
          'OPEN_PROOF',
          'ACCEPT_PROOF',
          'OPEN_DISPUTE',
          'CHAT'
        )
      }
      break
  }

  return actions
}

/**
 * Check if a specific action is allowed
 */
export function isActionAllowed(
  status: EscrowStatus,
  actorRole: ActorRole,
  action: RiftAction
): boolean {
  const allowedActions = getAllowedActions(status, actorRole)
  return allowedActions.includes(action)
}

/**
 * Get dispute eligibility rules
 */
export function canOpenDispute(
  status: EscrowStatus,
  actorRole: ActorRole,
  context?: {
    sellerPastSLA?: boolean
    isAbuseHarassment?: boolean
  }
): boolean {
    if (actorRole === 'BUYER') {
    // Buyer can dispute only if seller is past SLA (unresponsive / missed deadline)
    if (status === 'FUNDED' && context?.sellerPastSLA) {
      return true
    }
    // Buyer can dispute in PROOF_SUBMITTED, UNDER_REVIEW
    return ['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(status)
  }

  if (actorRole === 'SELLER') {
    // Seller can dispute after submitting proof (PROOF_SUBMITTED, UNDER_REVIEW)
    // Also can dispute for abuse/harassment/off-platform coercion in FUNDED status
    if (context?.isAbuseHarassment) {
      return ['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(status)
    }
    // Seller can open dispute after submitting proof
    return ['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(status)
  }

  return false
}

