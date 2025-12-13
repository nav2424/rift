/**
 * Rift state management
 * Handles state transitions with proper validation and side effects
 */

import { prisma } from './prisma'
import { EscrowStatus } from '@prisma/client'
import { validateTransition } from './state-machine'
import { creditSellerOnRelease } from './wallet'
import { schedulePayout } from './risk-tiers'
import { calculateSellerNet } from './fees'

/**
 * Transition rift to a new state with validation
 */
export async function transitionRiftState(
  riftId: string,
  newStatus: EscrowStatus,
  metadata?: {
    userId?: string
    reason?: string
    timestamp?: Date
  }
): Promise<void> {
  const rift = await prisma.escrowTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  // Validate transition
  validateTransition(rift.status, newStatus)

  // Use optimistic locking
  const updateData: any = {
    status: newStatus,
    version: { increment: 1 },
  }

  // Set timestamps based on state
  const now = metadata?.timestamp || new Date()
  switch (newStatus) {
    case 'FUNDED':
      updateData.fundedAt = now
      break
    case 'PROOF_SUBMITTED':
      updateData.proofSubmittedAt = now
      break
    case 'RELEASED':
      updateData.releasedAt = now
      break
  }

  // Update state
  await prisma.escrowTransaction.update({
    where: {
      id: riftId,
      version: rift.version, // Optimistic locking
    },
    data: updateData,
  })

  // Handle side effects based on new state
  if (newStatus === 'RELEASED') {
    await handleRelease(riftId)
  }
}

/**
 * Handle release state - credit seller wallet and schedule payout
 */
async function handleRelease(riftId: string): Promise<void> {
  const rift = await prisma.escrowTransaction.findUnique({
    where: { id: riftId },
    include: { seller: true },
  })

  if (!rift || !rift.sellerNet) {
    throw new Error('Rift not found or seller net not calculated')
  }

  // Credit seller wallet
  await creditSellerOnRelease(
    riftId,
    rift.sellerId,
    rift.sellerNet,
    rift.currency,
    {
      riftNumber: rift.riftNumber,
      itemTitle: rift.itemTitle,
    }
  )

  // Schedule payout
  await schedulePayout(riftId, rift.sellerId, rift.sellerNet, rift.currency)

  // Update user stats
  await prisma.user.update({
    where: { id: rift.sellerId },
    data: {
      totalProcessedAmount: { increment: rift.subtotal },
      numCompletedTransactions: { increment: 1 },
    },
  })

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      escrowId: riftId,
      type: 'FUNDS_RELEASED',
      message: `Funds released. Seller receives ${rift.currency} ${rift.sellerNet.toFixed(2)} (${rift.currency} ${rift.sellerFee.toFixed(2)} platform fee deducted)`,
    },
  })
}

/**
 * Calculate auto-release deadline based on item type and review window
 */
export function calculateAutoReleaseDeadline(
  itemType: string,
  proofSubmittedAt: Date | null,
  fundedAt: Date | null
): Date | null {
  // Default review window: 72 hours
  let reviewWindowHours = 72

  // Tickets/digital keys: 24-48 hours
  if (itemType === 'TICKETS' || itemType === 'DIGITAL') {
    reviewWindowHours = 48
  }

  // Use proof submitted time if available, otherwise use funded time
  const baseTime = proofSubmittedAt || fundedAt
  if (!baseTime) {
    return null
  }

  return new Date(baseTime.getTime() + reviewWindowHours * 60 * 60 * 1000)
}
