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
    const escrow = await prisma.escrowTransaction.findUnique({
      where: { id },
    })

    if (!escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    const userRole = getUserRole(
      auth.userId,
      escrow.buyerId,
      escrow.sellerId,
      auth.userRole
    )

    if (userRole !== 'BUYER') {
      return NextResponse.json({ error: 'Only buyer can confirm receipt' }, { status: 403 })
    }

    // Different flows based on item type
    const now = new Date()
    const isPhysical = escrow.itemType === 'PHYSICAL'
    const gracePeriodHours = getGracePeriodHours(escrow.itemType)
    
    // For physical items: check if shipment was verified
    // For other items: Buyer can manually release early (before auto-release timer)
    const shipmentWasVerified = isPhysical 
      ? (escrow.shipmentVerifiedAt !== null && escrow.trackingVerified)
      : true // Non-physical items don't need shipment verification

    let newStatus: 'IN_TRANSIT' | 'DELIVERED_PENDING_RELEASE' | 'RELEASED'
    let message: string
    const updateData: any = {}

    if (escrow.status === 'IN_TRANSIT' || escrow.status === 'AWAITING_SHIPMENT') {
      // Buyer confirming receipt
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
        // Non-physical items: Buyer can manually release early (before 24-hour auto-release)
        // This gives buyers the option to release immediately if satisfied
        newStatus = 'RELEASED'
        updateData.autoReleaseScheduled = false // Cancel auto-release since buyer is releasing early
        const itemTypeName = escrow.itemType.toLowerCase()
        message = `${itemTypeName.charAt(0).toUpperCase() + itemTypeName.slice(1)} confirmed. Funds released to seller!`
      }
    } else if (escrow.status === 'DELIVERED_PENDING_RELEASE') {
      // Buyer manually releasing before grace period ends (physical items only)
      newStatus = 'RELEASED'
      updateData.autoReleaseScheduled = false
      message = 'Funds released to seller.'
    } else {
      return NextResponse.json(
        { error: 'Invalid status for this action' },
        { status: 400 }
      )
    }

    if (!canTransition(escrow.status, newStatus, userRole)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      )
    }

    // Update escrow status and grace period
    const updatedEscrow = await prisma.escrowTransaction.update({
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
    if (newStatus === 'RELEASED' && (!isPhysical || escrow.status === 'DELIVERED_PENDING_RELEASE')) {
      try {
        // Calculate fees and seller payout amount
        // Total fee is 8% (includes platform fee + Stripe fees, all paid by seller)
        // Payment processing fees (2.9% + $0.30) are automatically deducted by Stripe, included in 8% total
        const feeBreakdown = getFeeBreakdown(updatedEscrow.amount ?? 0)
        const platformFee = roundCurrency(feeBreakdown.sellerFee)
        const sellerPayoutAmount = roundCurrency(feeBreakdown.sellerNet)

        // Process payout (if seller has payment account connected)
        let payoutId: string | null = null
        const sellerStripeAccountId = (updatedEscrow.seller as any).stripeAccountId

        if (sellerStripeAccountId) {
          try {
            payoutId = await createPayout(
              sellerPayoutAmount,
              updatedEscrow.amount ?? 0,
              platformFee,
              updatedEscrow.currency,
              sellerStripeAccountId,
              updatedEscrow.id
            )
          } catch (error) {
            console.error(`Payout failed for escrow ${updatedEscrow.id}:`, error)
            // Continue with release even if payout fails
          }
        }

        // Store fee information in escrow transaction
        await prisma.escrowTransaction.update({
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
          `Escrow completed: ${updatedEscrow.itemTitle}`,
          updatedEscrow.amount ?? 0,
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

        // Create timeline event for instant release with fee breakdown
        const processingFees = calculatePaymentProcessingFees(updatedEscrow.amount ?? 0)
        const totalFee = (updatedEscrow.amount ?? 0) * 0.08
        const feeMessage = `Total fee (8%: ${updatedEscrow.currency} ${totalFee.toFixed(2)}) deducted, including payment processing (${updatedEscrow.currency} ${processingFees.totalFee.toFixed(2)}) and platform fee (${updatedEscrow.currency} ${platformFee.toFixed(2)}). Seller receives: ${updatedEscrow.currency} ${sellerPayoutAmount.toFixed(2)}`
        await prisma.timelineEvent.create({
          data: {
            escrowId: id,
            type: 'FUNDS_RELEASED',
            message: `Funds released INSTANTLY. ${feeMessage}${payoutId ? ` (Payout ID: ${payoutId})` : ''}`,
            createdById: auth.userId,
          },
        })

        return NextResponse.json({ 
          success: true, 
          newStatus: 'RELEASED',
          instantPayout: true,
          payoutId 
        })
      } catch (error) {
        console.error('Error processing instant release:', error)
        // If release processing fails, we should rollback the status
        await prisma.escrowTransaction.update({
          where: { id },
          data: { status: escrow.status },
        })
        throw error
      }
    }

    // For physical items or items with grace period
    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: id,
        type: newStatus === 'RELEASED' ? 'FUNDS_RELEASED' : 'ITEM_CONFIRMED',
        message,
        createdById: auth.userId,
      },
    })

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

