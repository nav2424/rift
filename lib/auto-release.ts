/**
 * Auto-release system for verified shipments
 * Automatically releases funds after grace period if no disputes
 */

import { prisma } from './prisma'
import { updateBalanceOnRelease } from './balance'
import { createPayout } from './stripe'
import { sendFundsReleasedEmail } from './email'
import { createActivity } from './activity'
import { getLevelFromStats, getXpFromStats } from './levels'
import { checkAndAwardMilestones } from './milestones'
import { checkAndAwardBadges } from './badges'
import { calculatePlatformFee, calculateSellerPayout, roundCurrency, getFeeBreakdown, calculatePaymentProcessingFees } from './fees'

/**
 * Check and process auto-releases for escrows past grace period
 * This should be called periodically (e.g., via cron job or scheduled task)
 */
export async function processAutoReleases() {
  const now = new Date()

  // Find escrows that:
  // 1. Have delivery confirmed (deliveryVerifiedAt is set)
  // 2. Grace period has ended
  // 3. No open disputes
  // 4. Still in DELIVERED_PENDING_RELEASE or IN_TRANSIT status
  // 5. Auto-release is scheduled
  // 
  // For PHYSICAL items: Also require verified shipment
  // For other items: Just require delivery confirmation
  const escrowsToAutoRelease = await prisma.escrowTransaction.findMany({
    where: {
      deliveryVerifiedAt: { not: null },
      gracePeriodEndsAt: { lte: now },
      autoReleaseScheduled: true,
      status: {
        in: ['IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'],
      },
      OR: [
        // Physical items: require shipment verification AND buyer confirmation
        {
          itemType: 'PHYSICAL',
          shipmentVerifiedAt: { not: null },
        },
        // Non-physical items: require seller marked as delivered (deliveryVerifiedAt set)
        // Auto-release after 24 hours if seller marked delivered
        {
          itemType: { in: ['DIGITAL', 'TICKETS', 'SERVICES'] },
          deliveryVerifiedAt: { not: null }, // Seller must have marked as delivered
        },
      ],
      disputes: {
        none: {
          status: 'OPEN',
        },
      },
    },
    include: {
      seller: true,
      buyer: true,
      disputes: {
        where: { status: 'OPEN' },
      },
    },
  })

  const results = []

  for (const escrow of escrowsToAutoRelease) {
    try {
      // Double-check no disputes were raised
      if (escrow.disputes.length > 0) {
        console.log(`Skipping auto-release for ${escrow.id}: open disputes exist`)
        continue
      }

      // Calculate fees and seller payout amount
      // Total fee is 8% (includes platform fee + Stripe fees, all paid by seller)
      // Payment processing fees (2.9% + $0.30) are automatically deducted by Stripe, included in 8% total
      const feeBreakdown = getFeeBreakdown(escrow.amount)
      const platformFee = roundCurrency(feeBreakdown.platformFee)
      const sellerPayoutAmount = roundCurrency(feeBreakdown.sellerReceives)

      // Process payout (if seller has payment account connected)
      let payoutId: string | null = null
      const sellerStripeAccountId = (escrow.seller as any).stripeAccountId

      if (sellerStripeAccountId) {
        try {
          payoutId = await createPayout(
            sellerPayoutAmount,
            escrow.amount,
            platformFee,
            escrow.currency,
            sellerStripeAccountId,
            escrow.id
          )
        } catch (error) {
          console.error(`Payout failed for escrow ${escrow.id}:`, error)
          // Continue with release even if payout fails
        }
      }

      // Store fee information in escrow transaction
      await prisma.escrowTransaction.update({
        where: { id: escrow.id },
        data: {
          platformFee,
          sellerPayoutAmount,
        },
      })

      // Update balances
      await updateBalanceOnRelease(escrow.id)

      // Update escrow status
      await prisma.escrowTransaction.update({
        where: { id: escrow.id },
        data: {
          status: 'RELEASED',
          autoReleaseScheduled: false,
        },
      })

      // Create timeline event with fee breakdown
      const processingFees = calculatePaymentProcessingFees(escrow.amount)
      const totalFee = escrow.amount * 0.08
      const feeMessage = `Total fee (8%: ${escrow.currency} ${totalFee.toFixed(2)}) deducted, including payment processing (${escrow.currency} ${processingFees.totalFee.toFixed(2)}) and platform fee (${escrow.currency} ${platformFee.toFixed(2)}). Seller receives: ${escrow.currency} ${sellerPayoutAmount.toFixed(2)}`
      await prisma.timelineEvent.create({
        data: {
          escrowId: escrow.id,
          type: 'FUNDS_AUTO_RELEASED',
          message: `Funds automatically released after grace period. ${feeMessage}${payoutId ? ` (Payout ID: ${payoutId})` : ''}`,
        },
      })

      // Create activity for seller
      await createActivity(
        escrow.sellerId,
        'DEAL_CLOSED',
        `Escrow completed: ${escrow.itemTitle}`,
        escrow.amount,
        { transactionId: escrow.id }
      )

      // Level and milestone updates
      const sellerStats = await prisma.user.findUnique({
        where: { id: escrow.sellerId },
        select: {
          totalProcessedAmount: true,
          numCompletedTransactions: true,
        },
      })

      if (sellerStats) {
        const newLevel = getLevelFromStats(sellerStats.totalProcessedAmount, sellerStats.numCompletedTransactions)
        const xpGained = getXpFromStats(escrow.amount, sellerStats.numCompletedTransactions)

        await prisma.user.update({
          where: { id: escrow.sellerId },
          data: {
            level: newLevel,
            xp: { increment: xpGained },
          },
        })

        // Get seller stats for milestone/badge checking
        const seller = await prisma.user.findUnique({
          where: { id: escrow.sellerId },
          select: {
            totalProcessedAmount: true,
            numCompletedTransactions: true,
          },
        })

        if (seller) {
          await checkAndAwardMilestones(
            escrow.sellerId,
            seller.totalProcessedAmount,
            seller.numCompletedTransactions
          )
          await checkAndAwardBadges(escrow.sellerId)
        }
      }

      // Send email notification with fee breakdown
      await sendFundsReleasedEmail(
        escrow.seller.email,
        escrow.id,
        escrow.itemTitle,
        sellerPayoutAmount, // Amount seller actually receives
        escrow.currency,
        platformFee // Include platform fee for transparency
      )

      results.push({ escrowId: escrow.id, success: true })
    } catch (error) {
      console.error(`Error auto-releasing escrow ${escrow.id}:`, error)
      results.push({ escrowId: escrow.id, success: false, error: (error as Error).message })
    }
  }

  return results
}

/**
 * Update delivery status for escrows with tracking numbers
 * Should be called periodically to check delivery status
 */
export async function updateDeliveryStatus() {
  const escrows = await prisma.escrowTransaction.findMany({
    where: {
      itemType: 'PHYSICAL',
      shipmentVerifiedAt: { not: null },
      deliveryVerifiedAt: null, // Not yet delivered
      status: 'IN_TRANSIT',
      shipmentProofs: {
        some: {
          trackingNumber: { not: null },
        },
      },
    },
    include: {
      shipmentProofs: {
        where: { trackingNumber: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  const results = []

  for (const escrow of escrows) {
    const latestProof = escrow.shipmentProofs[0]
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
      //   await prisma.escrowTransaction.update({
      //     where: { id: escrow.id },
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

      results.push({ escrowId: escrow.id, checked: true })
    } catch (error) {
      console.error(`Error checking delivery for escrow ${escrow.id}:`, error)
      results.push({ escrowId: escrow.id, checked: false, error: (error as Error).message })
    }
  }

  return results
}

