/**
 * Auto-release system for Rift transactions
 * Automatically releases funds after review window if no disputes
 */

import { prisma } from './prisma'
import { sendFundsReleasedEmail } from './email'
import { createActivity } from './activity'
import { getLevelFromStats, getXpFromStats } from './levels'
import { checkAndAwardMilestones } from './milestones'
import { checkAndAwardBadges } from './badges'
import { transitionRiftState } from './rift-state'
import { canAutoRelease } from './state-machine'
import { normalizeMilestones, getNextUnreleasedMilestoneIndex } from './milestone-utils'
import { RiftEventActorType } from '@prisma/client'

/**
 * Check and process auto-releases for rifts past review window
 * This should be called periodically (e.g., via cron job or scheduled task)
 */
export async function processAutoReleases() {
  const now = new Date()

  // Find rifts that:
  // 1. Have proof submitted
  // 2. Auto-release deadline has passed
  // 3. No open disputes
  // 4. Still in PROOF_SUBMITTED or UNDER_REVIEW status
  const riftsToAutoRelease = await prisma.riftTransaction.findMany({
    where: {
      autoReleaseAt: { lte: now },
      status: {
        in: ['PROOF_SUBMITTED', 'UNDER_REVIEW'],
      },
      Dispute: {
        none: {
          status: 'OPEN',
        },
      },
    },
    include: {
      seller: true,
      buyer: true,
      Dispute: {
        where: { status: 'OPEN' },
      },
      Proof: {
        where: { status: 'VALID' },
        take: 1,
      },
      MilestoneRelease: {
        where: { status: 'RELEASED' },
      },
    },
  })

  const results = []

  for (const rift of riftsToAutoRelease) {
    try {
      // Double-check no disputes were raised
      if (rift.Dispute.length > 0) {
        console.log(`Skipping auto-release for ${rift.id}: open disputes exist`)
        continue
      }

      // Verify proof is valid (must be VALID status, not just PENDING)
      const validProofs = rift.Proof.filter(p => p.status === 'VALID')
      if (validProofs.length === 0) {
        console.log(`Skipping auto-release for ${rift.id}: no valid proof (proofs are PENDING or REJECTED)`)
        continue
      }

      // Verify payment was actually received
      // Rifts in PROOF_SUBMITTED/UNDER_REVIEW must have been funded, but double-check payment artifacts
      if (!rift.paymentReference && !rift.stripePaymentIntentId && !rift.fundedAt) {
        console.log(`Skipping auto-release for ${rift.id}: no payment confirmation found`)
        continue
      }

      // Verify state allows auto-release
      if (!canAutoRelease(rift.status)) {
        console.log(`Skipping auto-release for ${rift.id}: invalid state ${rift.status}`)
        continue
      }

      // Milestone-based services: auto-release the next milestone instead of full release
      if (rift.itemType === 'SERVICES' && rift.allowsPartialRelease && rift.milestones) {
        const milestones = normalizeMilestones(rift.milestones)
        const nextIndex = getNextUnreleasedMilestoneIndex(milestones, rift.MilestoneRelease)
        if (nextIndex === null) {
          console.log(`Skipping auto-release for ${rift.id}: all milestones already released`)
          continue
        }
        const { releaseMilestone } = await import('./milestone-release')
        await releaseMilestone({
          riftId: rift.id,
          milestoneIndex: nextIndex,
          releasedById: null,
          actorType: RiftEventActorType.SYSTEM,
          allowedStatuses: ['PROOF_SUBMITTED', 'UNDER_REVIEW'],
          requireBuyer: false,
          requireProofAfterLastRelease: nextIndex > 0,
          allowPendingProof: false,
          autoRelease: true,
        })

        results.push({ riftId: rift.id, success: true, autoReleasedMilestone: nextIndex })
        continue
      }

      // Transition to RELEASED (this handles wallet credit and payout scheduling)
      await transitionRiftState(rift.id, 'RELEASED')

      // Create timeline event
      // For sellers: Show only the rift value (what the item is worth)
      // For buyers: Show the rift value (what they paid for the item)
      const riftValue = rift.subtotal ?? 0
      await prisma.timelineEvent.create({
        data: {
          id: crypto.randomUUID(),
          escrowId: rift.id,
          type: 'FUNDS_AUTO_RELEASED',
          message: `Funds automatically released. Amount: ${rift.currency} ${riftValue.toFixed(2)}`,
        },
      })

      // Create activity for seller
      await createActivity(
        rift.sellerId,
        'DEAL_CLOSED',
        `Rift completed: ${rift.itemTitle}`,
        rift.subtotal,
        { transactionId: rift.id }
      )

      // Level and milestone updates
      const sellerStats = await prisma.user.findUnique({
        where: { id: rift.sellerId },
        select: {
          totalProcessedAmount: true,
          numCompletedTransactions: true,
        },
      })

      if (sellerStats) {
        const newLevel = getLevelFromStats(sellerStats.totalProcessedAmount, sellerStats.numCompletedTransactions)
        const xpGained = getXpFromStats(rift.subtotal, sellerStats.numCompletedTransactions)

        await prisma.user.update({
          where: { id: rift.sellerId },
          data: {
            level: newLevel,
            xp: { increment: xpGained },
          },
        })

        // Get seller stats for milestone/badge checking
        const seller = await prisma.user.findUnique({
          where: { id: rift.sellerId },
          select: {
            totalProcessedAmount: true,
            numCompletedTransactions: true,
          },
        })

        if (seller) {
          await checkAndAwardMilestones(
            rift.sellerId,
            seller.totalProcessedAmount,
            seller.numCompletedTransactions
          )
          await checkAndAwardBadges(rift.sellerId)
        }
      }

      // Send email notification
      if (rift.sellerNet) {
        await sendFundsReleasedEmail(
          rift.seller.email,
          rift.id,
          rift.itemTitle,
          rift.sellerNet,
          rift.currency,
          rift.sellerFee
        )
      }

      results.push({ riftId: rift.id, success: true })
    } catch (error) {
      console.error(`Error auto-releasing rift ${rift.id}:`, error)
      results.push({ riftId: rift.id, success: false, error: (error as Error).message })
    }
  }

  return results
}

/**
 * Update delivery status for rifts with tracking numbers
 * Should be called periodically to check delivery status
 */
export async function updateDeliveryStatus() {
  const rifts = await prisma.riftTransaction.findMany({
    where: {
      itemType: 'PHYSICAL',
      shipmentVerifiedAt: { not: null },
      deliveryVerifiedAt: null, // Not yet delivered
      status: 'IN_TRANSIT',
        ShipmentProof: {
        some: {
          trackingNumber: { not: null },
        },
      },
    },
    include: {
        ShipmentProof: {
        where: { trackingNumber: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  const results = []

  for (const rift of rifts) {
    const latestProof = rift.ShipmentProof[0]
    if (!latestProof || !latestProof.trackingNumber) continue

    try {
      // TODO: Call actual tracking API to check delivery status
      // For now, this is a placeholder
      // In production, you would:
      // 1. Call carrier API to check tracking status
      // 2. If delivered, update deliveryVerifiedAt and set grace period
      // 3. Notify buyer that item is delivered

      // Placeholder - implement actual tracking check
      // const { isDelivered, deliveryDate } = await checkDeliveryStatus(
      //   latestProof.trackingNumber,
      //   latestProof.shippingCarrier || undefined
      // )

      // if (isDelivered && deliveryDate) {
      //   const gracePeriodHours = 48
      //   const gracePeriodEndsAt = new Date(deliveryDate.getTime() + gracePeriodHours * 60 * 60 * 1000)
      //
      //   await prisma.riftTransaction.update({
      //     where: { id: rift.id },
      //     data: {
      //       deliveryVerifiedAt: deliveryDate,
      //       gracePeriodEndsAt: gracePeriodEndsAt,
      //       autoReleaseScheduled: true,
      //       status: 'DELIVERED_PENDING_RELEASE',
      //     },
      //   })
      //
      //   await prisma.shipmentProof.update({
      //     where: { id: latestProof.id },
      //     data: {
      //       deliveryStatus: 'DELIVERED',
      //       deliveryDate: deliveryDate,
      //     },
      //   })
      // }

      results.push({ escrowId: rift.id, checked: true })
    } catch (error) {
      console.error(`Error checking delivery for rift ${rift.id}:`, error)
      results.push({ escrowId: rift.id, checked: false, error: (error as Error).message })
    }
  }

  return results
}

