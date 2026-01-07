/**
 * Rift state management
 * Handles state transitions with proper validation and side effects
 */

import { prisma } from './prisma'
import { EscrowStatus, RiftEventActorType } from '@prisma/client'
import { validateTransition } from './state-machine'
import { creditSellerOnRelease } from './wallet'
import { schedulePayout } from './risk-tiers'
import { calculateSellerNet } from './fees'
import { logEvent } from './rift-events'
import { sendRiftStatusUpdateEmail } from './email'
import { randomUUID } from 'crypto'

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
  const rift = await prisma.riftTransaction.findUnique({
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
      updateData.paidAt = now
      break
    case 'PROOF_SUBMITTED':
      updateData.proofSubmittedAt = now
      break
    case 'RELEASED':
      updateData.releasedAt = now
      break
  }

  // Update state
  await prisma.riftTransaction.update({
    where: {
      id: riftId,
      version: rift.version, // Optimistic locking
    },
    data: updateData,
  })

  // Log status transition event
  let actorType: RiftEventActorType = 'SYSTEM'
  if (metadata?.userId) {
    // Determine if user is buyer or seller
    if (rift.buyerId === metadata.userId) {
      actorType = 'BUYER'
    } else if (rift.sellerId === metadata.userId) {
      actorType = 'SELLER'
    } else {
      // Could be admin - check user role
      const user = await prisma.user.findUnique({
        where: { id: metadata.userId },
        select: { role: true },
      })
      actorType = user?.role === 'ADMIN' ? 'ADMIN' : 'SYSTEM'
    }
  }

  await logEvent(
    riftId,
    actorType,
    metadata?.userId || null,
    'STATUS_TRANSITION',
    {
      fromStatus: rift.status,
      toStatus: newStatus,
      reason: metadata?.reason || null,
    }
  )

  // Create timeline event for important status transitions
  // Only create for meaningful transitions (not duplicates)
  if (rift.status !== newStatus) {
    const statusMessages: Partial<Record<EscrowStatus, string>> = {
      FUNDED: 'Payment received',
      PROOF_SUBMITTED: 'Proof of delivery submitted',
      UNDER_REVIEW: 'Proof under review',
      DISPUTED: 'Dispute raised',
      RESOLVED: 'Dispute resolved',
      CANCELED: 'Rift canceled',
      RELEASED: 'Funds released',
    }

    const timelineMessage = statusMessages[newStatus]
    
    // Only create timeline event for important status changes
    // Note: Some status changes already have specific timeline events (e.g., PROOF_SUBMITTED, FUNDED)
    // So we only create STATUS_CHANGE events for transitions that don't have specific events
    if (timelineMessage && !['PROOF_SUBMITTED', 'FUNDED'].includes(newStatus)) {
      try {
        // Check if a similar event was just created (within last 3 seconds) to avoid duplicates
        const threeSecondsAgo = new Date(Date.now() - 3000)
        const recentEvent = await prisma.timelineEvent.findFirst({
          where: {
            escrowId: riftId,
            type: 'STATUS_CHANGE',
            message: timelineMessage,
            createdAt: {
              gte: threeSecondsAgo,
            },
          },
        })

        if (!recentEvent) {
          await prisma.timelineEvent.create({
            data: {
              id: randomUUID(),
              escrowId: riftId,
              type: 'STATUS_CHANGE',
              message: timelineMessage,
              createdById: metadata?.userId || null,
            },
          })
          console.log(`✅ Created timeline event: ${timelineMessage} for rift ${riftId}`)
        }
      } catch (timelineError: any) {
        // Log but don't fail the transition if timeline event creation fails
        console.error('Timeline event creation error:', timelineError)
      }
    }
  }

  // Handle side effects based on new state
  if (newStatus === 'RELEASED') {
    await handleRelease(riftId, metadata?.userId)
  }
}

/**
 * Handle release state - credit seller wallet and create Stripe transfer
 */
async function handleRelease(riftId: string, userId?: string): Promise<void> {
  // Check dispute freeze before releasing
  const { checkDisputeFreeze } = await import('./dispute-freeze')
  const freezeCheck = await checkDisputeFreeze(riftId)
  
  if (freezeCheck.frozen) {
    throw new Error(`Cannot release funds: ${freezeCheck.reason}`)
  }

  // Acquire concurrency lock
  const { acquireFullReleaseLock } = await import('./release-concurrency')
  const lock = await acquireFullReleaseLock(riftId)
  
  if (!lock) {
    throw new Error('Failed to acquire release lock')
  }

  // If already released, return early
  if (lock.status === 'CREATED' && lock.releaseId !== 'already_released') {
    console.log(`Rift ${riftId} already released with transfer ${lock.releaseId}`)
    return
  }

  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: { seller: true },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  // Get sellerPayout from PaymentIntent metadata (source of truth)
  let sellerPayout: number | null = null
  let stripeTransferId: string | null = null

  if (rift.stripePaymentIntentId) {
    try {
      const { stripe } = await import('./stripe')
      if (stripe) {
        const paymentIntent = await stripe.paymentIntents.retrieve(rift.stripePaymentIntentId)
        sellerPayout = parseFloat(paymentIntent.metadata?.sellerPayout || '0')
        
        // Create Stripe transfer to seller's connected account
        if (sellerPayout > 0 && rift.seller.stripeConnectAccountId) {
          const { createRiftTransfer } = await import('./stripe')
          stripeTransferId = await createRiftTransfer(
            sellerPayout,
            rift.currency,
            rift.seller.stripeConnectAccountId,
            riftId,
            undefined, // No milestone ID for full release
            rift.stripeTransferId || null // Check for existing transfer (idempotency)
          )
        }
      }
    } catch (error: any) {
      console.error(`Error creating Stripe transfer for rift ${riftId}:`, error)
      
      // If balance insufficient, throw error (don't silently fail)
      if (error.message?.includes('Insufficient Stripe balance')) {
        throw new Error(`Cannot release funds: ${error.message}`)
      }
      
      // Continue with release even if transfer fails (funds stay in wallet)
      // But log the error for monitoring
    }
  }

  // Fallback: Calculate seller net if not available from metadata
  let sellerNet = sellerPayout || rift.sellerNet
  if (!sellerNet && rift.subtotal) {
    sellerNet = calculateSellerNet(rift.subtotal)
    
    // Update the rift with calculated sellerNet
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: { sellerNet },
    })
  }

  if (!sellerNet) {
    throw new Error('Seller net could not be calculated - subtotal is missing')
  }

  // Credit seller wallet
  await creditSellerOnRelease(
    riftId,
    rift.sellerId,
    sellerNet,
    rift.currency,
    {
      riftNumber: rift.riftNumber,
      itemTitle: rift.itemTitle,
    }
  )

  // Store transfer ID if created
  if (stripeTransferId) {
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: { stripeTransferId },
    })
  }

  // Schedule payout (for wallet withdrawals if transfer wasn't created)
  await schedulePayout(riftId, rift.sellerId, sellerNet, rift.currency)

  // Update user stats
  await prisma.user.update({
    where: { id: rift.sellerId },
    data: {
      totalProcessedAmount: { increment: rift.subtotal },
      numCompletedTransactions: { increment: 1 },
    },
  })

  // Create timeline event - check for duplicates first
  // Only create if no FUNDS_RELEASED event exists for this rift
  const existingEvent = await prisma.timelineEvent.findFirst({
    where: {
      escrowId: riftId,
      type: 'FUNDS_RELEASED',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!existingEvent) {
    // For sellers: Show only the rift value (what the item is worth)
    // For buyers: Show the rift value (what they paid for the item)
    const riftValue = rift.subtotal ?? 0
    try {
      await prisma.timelineEvent.create({
        data: {
          id: randomUUID(),
          escrowId: riftId,
          type: 'FUNDS_RELEASED',
          message: `Funds released to seller. Amount: ${rift.currency} ${riftValue.toFixed(2)}`,
          createdById: userId || null,
        },
      })
      console.log(`✅ Created FUNDS_RELEASED timeline event for rift ${riftId}`)
    } catch (error: any) {
      console.error('Error creating FUNDS_RELEASED timeline event:', error)
      // Don't throw - timeline event failure shouldn't block release
    }
  } else {
    console.log(`⚠️ FUNDS_RELEASED event already exists for rift ${riftId}`)
  }

  // Send email notification (not in chat)
  try {
    const riftWithUsers = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      include: {
        buyer: true,
        seller: true,
      },
    })
    
    if (riftWithUsers) {
      const riftValue = rift.subtotal ?? 0
      await sendRiftStatusUpdateEmail(
        riftWithUsers.buyer.email,
        riftWithUsers.seller.email,
        riftId,
        riftWithUsers.itemTitle,
        'RELEASED',
        `Funds have been released. Amount: ${rift.currency} ${riftValue.toFixed(2)}`
      )
    }
  } catch (emailError) {
    console.error('Error sending rift status update email:', emailError)
    // Don't fail the release if email fails
  }
}

/**
 * Calculate auto-release deadline based on item type and review window
 */
export function calculateAutoReleaseDeadline(
  itemType: string,
  proofSubmittedAt: Date | null,
  paidAt: Date | null
): Date | null {
  // Default review window: 72 hours
  let reviewWindowHours = 72

  // Digital goods: 24-48 hours
  if (itemType === 'DIGITAL_GOODS') {
    reviewWindowHours = 48
  }

  // Use proof submitted time if available, otherwise use funded time
  const baseTime = proofSubmittedAt || paidAt
  if (!baseTime) {
    return null
  }

  return new Date(baseTime.getTime() + reviewWindowHours * 60 * 60 * 1000)
}
