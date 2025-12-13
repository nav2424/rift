import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { canTransition, getUserRole } from '@/lib/rules'
import { createPayout } from '@/lib/stripe'
import { sendFundsReleasedEmail } from '@/lib/email'
import { updateBalanceOnRelease } from '@/lib/balance'
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
      include: {
        seller: true,
      },
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
      return NextResponse.json(
        { error: 'Only buyer can release funds' },
        { status: 403 }
      )
    }

    // Allow release from DELIVERED_PENDING_RELEASE (standard flow)
    // Also allow early release from IN_TRANSIT for non-physical items (instant items)
    const isEarlyRelease = escrow.status === 'IN_TRANSIT' && escrow.itemType !== 'PHYSICAL'
    const isStandardRelease = escrow.status === 'DELIVERED_PENDING_RELEASE'

    if (!isStandardRelease && !isEarlyRelease) {
      return NextResponse.json(
        { 
          error: 'Funds can only be released when status is DELIVERED_PENDING_RELEASE, or from IN_TRANSIT for non-physical items' 
        },
        { status: 400 }
      )
    }

    // For standard release (DELIVERED_PENDING_RELEASE), check transition rules
    // For early release (IN_TRANSIT non-physical), skip transition check as it's a special case
    if (isStandardRelease && !canTransition(escrow.status, 'RELEASED', userRole)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      )
    }

    // Calculate fees and seller payout amount
    // Total fee is 8% (includes platform fee + Stripe fees, all paid by seller)
    // Payment processing fees (2.9% + $0.30) are automatically deducted by Stripe, included in 8% total
    const feeBreakdown = getFeeBreakdown(escrow.amount ?? 0)
    const platformFee = roundCurrency(feeBreakdown.sellerFee)
    const sellerPayoutAmount = roundCurrency(feeBreakdown.sellerNet)

    // Process payout (if seller has payment account connected)
    // For V1, we'll store payout info even if payment account isn't set up
    let payoutId: string | null = null
    const sellerStripeAccountId = (escrow.seller as any).stripeAccountId

    if (sellerStripeAccountId) {
      payoutId = await createPayout(
        sellerPayoutAmount,
        escrow.amount ?? 0,
        platformFee,
        escrow.currency,
        sellerStripeAccountId,
        id
      )
    }

    // Update escrow status and store fee information
    // For early release from IN_TRANSIT, cancel auto-release since buyer is releasing early
    await prisma.escrowTransaction.update({
      where: { id },
      data: {
        status: 'RELEASED',
        platformFee,
        sellerPayoutAmount,
        autoReleaseScheduled: false, // Cancel auto-release if buyer releases early
        paymentReference: payoutId
          ? `${escrow.paymentReference} | Payout: ${payoutId}`
          : escrow.paymentReference,
      },
    })

    // Update seller balance (move from pending to processed)
    await updateBalanceOnRelease(id)

    // Get updated seller stats
    const seller = await prisma.user.findUnique({
      where: { id: escrow.sellerId },
      select: {
        totalProcessedAmount: true,
        numCompletedTransactions: true,
        level: true,
      },
    })

    if (seller) {
      // Recalculate level
      const newLevel = getLevelFromStats(
        seller.totalProcessedAmount,
        seller.numCompletedTransactions
      )
      const newXp = getXpFromStats(
        seller.totalProcessedAmount,
        seller.numCompletedTransactions
      )

      // Update level if changed
      if (newLevel !== seller.level) {
        // @ts-ignore - Prisma client will be generated after migration
        await prisma.user.update({
          where: { id: escrow.sellerId },
          data: {
            level: newLevel,
            xp: newXp,
          } as any,
        })

        // Create level up activity
        await createActivity(
          escrow.sellerId,
          'LEVEL_UP',
          `Leveled up to ${newLevel.replace('_', ' ')}!`,
          undefined,
          { level: newLevel }
        )
      } else {
        // Just update XP
        // @ts-ignore - Prisma client will be generated after migration
        await prisma.user.update({
          where: { id: escrow.sellerId },
          data: { xp: newXp } as any,
        })
      }

      // Check and award milestones
      const newMilestones = await checkAndAwardMilestones(
        escrow.sellerId,
        seller.totalProcessedAmount,
        seller.numCompletedTransactions
      )

      // Create activities for new milestones
      for (const milestoneType of newMilestones) {
        await createActivity(
          escrow.sellerId,
          'MILESTONE_ACHIEVED',
          `Achieved milestone: ${milestoneType}`,
          undefined,
          { milestoneType }
        )
      }

      // Check and award badges
      const newBadges = await checkAndAwardBadges(escrow.sellerId)

      // Create activities for new badges
      for (const badgeCode of newBadges) {
        await createActivity(
          escrow.sellerId,
          'BADGE_EARNED',
          `Earned badge: ${badgeCode}`,
          undefined,
          { badgeCode }
        )
      }
    }

    // Create activity for deal closed
    await createActivity(
      escrow.sellerId,
      'DEAL_CLOSED',
      `Closed deal: ${escrow.itemTitle}`,
      escrow.amount,
      { transactionId: id }
    )

    // Create timeline event with fee breakdown
    const processingFees = calculatePaymentProcessingFees(escrow.amount)
    const totalFee = escrow.amount * 0.08
    const feeMessage = `Total fee (8%: ${escrow.currency} ${totalFee.toFixed(2)}) deducted, including payment processing (${escrow.currency} ${processingFees.totalFee.toFixed(2)}) and platform fee (${escrow.currency} ${platformFee.toFixed(2)}). Seller receives: ${escrow.currency} ${sellerPayoutAmount.toFixed(2)}`
    await prisma.timelineEvent.create({
      data: {
        escrowId: id,
        type: 'FUNDS_RELEASED',
        message: `Funds released to seller. ${feeMessage}${payoutId ? ` (Payout ID: ${payoutId})` : ''}`,
        createdById: auth.userId,
      },
    })

    // Send email notification with fee breakdown
    await sendFundsReleasedEmail(
      escrow.seller.email,
      id,
      escrow.itemTitle,
      sellerPayoutAmount, // Amount seller actually receives
      escrow.currency,
      platformFee // Include platform fee for transparency
    )

    return NextResponse.json({
      success: true,
      newStatus: 'RELEASED',
      payoutId,
    })
  } catch (error) {
    console.error('Release funds error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
