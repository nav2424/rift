import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { canTransition, getUserRole } from '@/lib/rules'
import { sendItemReceivedEmail, sendFundsReleasedEmail } from '@/lib/email'
import { getGracePeriodHours, usesHybridProtection } from '@/lib/item-type-flows'
import { updateBalanceOnRelease } from '@/lib/balance'
import { createPayout } from '@/lib/stripe'
import { createActivity } from '@/lib/activity'
import { getLevelFromStats, getXpFromStats } from '@/lib/levels'
import { checkAndAwardMilestones } from '@/lib/milestones'
import { checkAndAwardBadges } from '@/lib/badges'
import { calculateSellerFee, calculateSellerNet, roundCurrency, getFeeBreakdown, calculatePaymentProcessingFees } from '@/lib/fees'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    const userRole = getUserRole(
      auth.userId,
      rift.buyerId,
      rift.sellerId,
      auth.userRole
    )

    if (userRole !== 'BUYER') {
      return NextResponse.json({ error: 'Only buyer can confirm receipt' }, { status: 403 })
    }

    // Different flows based on item type
    const now = new Date()
    const isPhysical = rift.itemType === 'PHYSICAL'
    const gracePeriodHours = getGracePeriodHours(rift.itemType)
    
    // For physical items: check if shipment was verified
    // For other items: Buyer can manually release early (before auto-release timer)
    const shipmentWasVerified = isPhysical 
      ? (rift.shipmentVerifiedAt !== null && rift.trackingVerified)
      : true // Non-physical items don't need shipment verification

    let newStatus: 'UNDER_REVIEW' | 'DELIVERED_PENDING_RELEASE' | 'RELEASED'
    let message: string
    const updateData: any = {}

    // New status system: PROOF_SUBMITTED or UNDER_REVIEW -> RELEASED
    // Legacy support: IN_TRANSIT or AWAITING_SHIPMENT -> DELIVERED_PENDING_RELEASE or RELEASED
    if (rift.status === 'PROOF_SUBMITTED' || rift.status === 'UNDER_REVIEW') {
      // New system: Buyer can release directly from proof submitted or under review
      newStatus = 'RELEASED'
      updateData.autoReleaseScheduled = false
      const itemTypeName = rift.itemType.toLowerCase()
      message = `${itemTypeName.charAt(0).toUpperCase() + itemTypeName.slice(1)} confirmed. Funds released to seller!`
    } else if (rift.status === 'IN_TRANSIT' || rift.status === 'AWAITING_SHIPMENT') {
      // Legacy system: Buyer confirming receipt
      if (isPhysical) {
        // Physical item with grace period
        const gracePeriodEndsAt = new Date(now.getTime() + gracePeriodHours * 60 * 60 * 1000)
        newStatus = 'DELIVERED_PENDING_RELEASE'
        updateData.deliveryVerifiedAt = now
        updateData.gracePeriodEndsAt = gracePeriodEndsAt
        
        if (shipmentWasVerified) {
          // Physical item with verified shipment: 48-hour grace period, hybrid protection
          updateData.autoReleaseScheduled = true
          message = `Item received. ${gracePeriodHours}-hour grace period started. Funds will auto-release on ${gracePeriodEndsAt.toLocaleString()} unless you raise a dispute.`
        } else {
          // Physical item without verification: Standard flow
          message = 'Item received. Funds ready to be released.'
        }
      } else {
        // Non-physical items: Buyer can manually release early
        newStatus = 'RELEASED'
        updateData.autoReleaseScheduled = false
        const itemTypeName = rift.itemType.toLowerCase()
        message = `${itemTypeName.charAt(0).toUpperCase() + itemTypeName.slice(1)} confirmed. Funds released to seller!`
      }
    } else if (rift.status === 'DELIVERED_PENDING_RELEASE') {
      // Legacy: Buyer manually releasing before grace period ends (physical items only)
      newStatus = 'RELEASED'
      updateData.autoReleaseScheduled = false
      message = 'Funds released to seller.'
    } else {
      return NextResponse.json(
        { error: 'Invalid status for this action. Rift must be in PROOF_SUBMITTED, UNDER_REVIEW, IN_TRANSIT, or DELIVERED_PENDING_RELEASE status.' },
        { status: 400 }
      )
    }

    if (!canTransition(rift.status, newStatus, userRole)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      )
    }

    // If releasing funds, verify proof is approved (must be VALID status, not PENDING)
    // This prevents funds from being released before proof is reviewed
    if (newStatus === 'RELEASED') {
      const validProofs = await prisma.proof.findMany({
        where: {
          riftId: id,
          status: 'VALID',
        },
      })

      // Only require proof validation if proof was submitted
      // Check if any proof exists (even if pending)
      const anyProofs = await prisma.proof.findMany({
        where: {
          riftId: id,
        },
      })

      // If proof was submitted but not approved, block release
      if (anyProofs.length > 0 && validProofs.length === 0) {
        return NextResponse.json(
          { 
            error: 'Cannot release funds: Proof must be approved by admin before funds can be released. Please wait for proof review.' 
          },
          { status: 400 }
        )
      }
    }

    // Update rift status and grace period
    const updatedEscrow = await prisma.riftTransaction.update({
      where: { id },
      data: {
        status: newStatus,
        ...updateData,
      },
      include: {
        seller: true,
        buyer: true,
      },
    })

    // If buyer manually releasing (non-physical items), process the release
    if (newStatus === 'RELEASED' && (!isPhysical || rift.status === 'DELIVERED_PENDING_RELEASE')) {
      try {
        // Calculate fees and seller payout amount using subtotal
        // Total fee is 8% (includes platform fee + Stripe fees, all paid by seller)
        // Payment processing fees (2.9% + $0.30) are automatically deducted by Stripe, included in 8% total
        const feeBreakdown = getFeeBreakdown(updatedEscrow.subtotal)
        const platformFee = roundCurrency(feeBreakdown.sellerFee)
        const sellerPayoutAmount = roundCurrency(feeBreakdown.sellerNet)

        // Process payout (if seller has payment account connected)
        let payoutId: string | null = null
        const sellerStripeAccountId = (updatedEscrow.seller as any).stripeAccountId

        if (sellerStripeAccountId) {
          try {
            payoutId = await createPayout(
              sellerPayoutAmount,
              updatedEscrow.subtotal,
              platformFee,
              updatedEscrow.currency,
              sellerStripeAccountId,
              updatedEscrow.id
            )
          } catch (error) {
            console.error(`Payout failed for rift ${updatedEscrow.id}:`, error)
            // Continue with release even if payout fails
          }
        }

        // Store fee information in rift transaction
        await prisma.riftTransaction.update({
          where: { id: updatedEscrow.id },
          data: {
            platformFee,
            sellerPayoutAmount,
          },
        })

        // Update balances
        await updateBalanceOnRelease(updatedEscrow.id)

        // Create activity for seller
        await createActivity(
          updatedEscrow.sellerId,
          'DEAL_CLOSED',
          `Rift completed: ${updatedEscrow.itemTitle}`,
          updatedEscrow.subtotal,
          { transactionId: updatedEscrow.id }
        )

        // Level and milestone updates
        const sellerStats = await prisma.user.findUnique({
          where: { id: updatedEscrow.sellerId },
          select: {
            totalProcessedAmount: true,
            numCompletedTransactions: true,
          },
        })

        if (sellerStats) {
          const newLevel = getLevelFromStats(sellerStats.totalProcessedAmount, sellerStats.numCompletedTransactions)
          const xpGained = getXpFromStats(updatedEscrow.amount ?? 0, sellerStats.numCompletedTransactions)

          await prisma.user.update({
            where: { id: updatedEscrow.sellerId },
            data: {
              level: newLevel,
              xp: { increment: xpGained },
            },
          })

          // Get seller stats for milestone/badge checking
          const seller = await prisma.user.findUnique({
            where: { id: updatedEscrow.sellerId },
            select: {
              totalProcessedAmount: true,
              numCompletedTransactions: true,
            },
          })

          if (seller) {
            await checkAndAwardMilestones(
              updatedEscrow.sellerId,
              seller.totalProcessedAmount,
              seller.numCompletedTransactions
            )
            await checkAndAwardBadges(updatedEscrow.sellerId)
          }
        }

        // Send email notification with fee breakdown
        await sendFundsReleasedEmail(
          updatedEscrow.seller.email,
          updatedEscrow.id,
          updatedEscrow.itemTitle,
          sellerPayoutAmount, // Amount seller actually receives
          updatedEscrow.currency,
          platformFee // Include platform fee for transparency
        )

        // Create timeline event for instant release
        // Check if event already exists to prevent duplicates
        const existingEvent = await prisma.timelineEvent.findFirst({
          where: {
            riftId: id,
            type: 'FUNDS_RELEASED',
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        if (!existingEvent) {
          const riftValue = updatedEscrow.subtotal ?? 0
          await prisma.timelineEvent.create({
            data: {
              escrowId: id,
              type: 'FUNDS_RELEASED',
              message: `Funds released. Amount: ${updatedEscrow.currency} ${riftValue.toFixed(2)}${payoutId ? ` (Payout ID: ${payoutId})` : ''}`,
              createdById: auth.userId,
            },
          })
        }

        return NextResponse.json({ 
          success: true, 
          newStatus: 'RELEASED',
          instantPayout: true,
          payoutId 
        })
      } catch (error) {
        console.error('Error processing instant release:', error)
        // If release processing fails, we should rollback the status
        await prisma.riftTransaction.update({
          where: { id },
          data: { status: rift.status },
        })
        throw error
      }
    }

    // For physical items or items with grace period
    // Create timeline event (but skip if RELEASED to avoid duplicate with handleRelease)
    if (newStatus !== 'RELEASED') {
      await prisma.timelineEvent.create({
        data: {
          escrowId: id,
          type: 'ITEM_CONFIRMED',
          message,
          createdById: auth.userId,
        },
      })
    }
    // Note: If newStatus is RELEASED, timeline event should be created by transitionRiftState/handleRelease

    // Send email notification if item confirmed (not released - that's handled separately)
    if (newStatus === 'DELIVERED_PENDING_RELEASE') {
      if (updatedEscrow.seller) {
        await sendItemReceivedEmail(
          updatedEscrow.seller.email,
          id,
          updatedEscrow.itemTitle
        )
      }
    }

    return NextResponse.json({ success: true, newStatus })
  } catch (error) {
    console.error('Confirm received error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

