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
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      include: {
        seller: true,
      },
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
      return NextResponse.json(
        { error: 'Only buyer can release funds' },
        { status: 403 }
      )
    }

    // Check if already released
    if (rift.status === 'RELEASED') {
      return NextResponse.json(
        { 
          error: 'Funds have already been released for this rift' 
        },
        { status: 400 }
      )
    }

    // Allow release from PROOF_SUBMITTED or UNDER_REVIEW (new status system)
    // Also support legacy statuses for backward compatibility
    const canRelease = 
      rift.status === 'PROOF_SUBMITTED' || 
      rift.status === 'UNDER_REVIEW' ||
      rift.status === 'DELIVERED_PENDING_RELEASE' || // Legacy support
      (rift.status === 'IN_TRANSIT' && rift.itemType !== 'PHYSICAL') // Legacy early release

    if (!canRelease) {
      return NextResponse.json(
        { 
          error: `Cannot release funds in ${rift.status} state. Funds can only be released when status is PROOF_SUBMITTED, UNDER_REVIEW, or DELIVERED_PENDING_RELEASE` 
        },
        { status: 400 }
      )
    }

    // Check transition rules
    if (!canTransition(rift.status, 'RELEASED', userRole)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      )
    }

    // Verify proof is approved (must be VALID status, not PENDING)
    // This prevents funds from being released before proof is reviewed
    const validProofs = await prisma.proof.findMany({
      where: {
        riftId: id,
        status: 'VALID',
      },
    })

    if (validProofs.length === 0) {
      return NextResponse.json(
        { 
          error: 'Cannot release funds: Proof must be approved by admin before funds can be released. Please wait for proof review.' 
        },
        { status: 400 }
      )
    }

    // Calculate fees and seller payout amount using subtotal
    // Total fee is 8% (includes platform fee + Stripe fees, all paid by seller)
    // Payment processing fees (2.9% + $0.30) are automatically deducted by Stripe, included in 8% total
    const feeBreakdown = getFeeBreakdown(rift.subtotal)
    const platformFee = roundCurrency(feeBreakdown.sellerFee)
    const sellerPayoutAmount = roundCurrency(feeBreakdown.sellerNet)

    // Process payout (if seller has payment account connected)
    // For V1, we'll store payout info even if payment account isn't set up
    let payoutId: string | null = null
    const sellerStripeAccountId = (rift.seller as any).stripeAccountId

    if (sellerStripeAccountId) {
      payoutId = await createPayout(
        sellerPayoutAmount,
        rift.subtotal,
        platformFee,
        rift.currency,
        sellerStripeAccountId,
        id
      )
    }

    // Update rift status and store fee information
    // For early release from IN_TRANSIT, cancel auto-release since buyer is releasing early
    await prisma.riftTransaction.update({
      where: { id },
      data: {
        status: 'RELEASED',
        platformFee,
        sellerPayoutAmount,
        autoReleaseScheduled: false, // Cancel auto-release if buyer releases early
        paymentReference: payoutId
          ? `${rift.paymentReference} | Payout: ${payoutId}`
          : rift.paymentReference,
      },
    })

    // Update seller balance (move from pending to processed)
    await updateBalanceOnRelease(id)

    // Get updated seller stats
    const seller = await prisma.user.findUnique({
      where: { id: rift.sellerId },
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
          where: { id: rift.sellerId },
          data: {
            level: newLevel,
            xp: newXp,
          } as any,
        })

        // Create level up activity
        await createActivity(
          rift.sellerId,
          'LEVEL_UP',
          `Leveled up to ${newLevel.replace('_', ' ')}!`,
          undefined,
          { level: newLevel }
        )
      } else {
        // Just update XP
        // @ts-ignore - Prisma client will be generated after migration
        await prisma.user.update({
          where: { id: rift.sellerId },
          data: { xp: newXp } as any,
        })
      }

      // Check and award milestones
      const newMilestones = await checkAndAwardMilestones(
        rift.sellerId,
        seller.totalProcessedAmount,
        seller.numCompletedTransactions
      )

      // Create activities for new milestones
      for (const milestoneType of newMilestones) {
        await createActivity(
          rift.sellerId,
          'MILESTONE_ACHIEVED',
          `Achieved milestone: ${milestoneType}`,
          undefined,
          { milestoneType }
        )
      }

      // Check and award badges
      const newBadges = await checkAndAwardBadges(rift.sellerId)

      // Create activities for new badges
      for (const badgeCode of newBadges) {
        await createActivity(
          rift.sellerId,
          'BADGE_EARNED',
          `Earned badge: ${badgeCode}`,
          undefined,
          { badgeCode }
        )
      }
    }

    // Create activity for deal closed
    await createActivity(
      rift.sellerId,
      'DEAL_CLOSED',
      `Closed deal: ${rift.itemTitle}`,
      rift.subtotal,
      { transactionId: id }
    )

    // Create timeline event - check for duplicates first
    // Only create if no FUNDS_RELEASED event exists for this rift
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
      const riftValue = rift.subtotal ?? 0
      await prisma.timelineEvent.create({
        data: {
          escrowId: id,
          type: 'FUNDS_RELEASED',
          message: `Funds released. Amount: ${rift.currency} ${riftValue.toFixed(2)}${payoutId ? ` (Payout ID: ${payoutId})` : ''}`,
          createdById: auth.userId,
        },
      })
    }

    // Send email notification with fee breakdown
    await sendFundsReleasedEmail(
      rift.seller.email,
      id,
      rift.itemTitle,
      sellerPayoutAmount, // Amount seller actually receives
      rift.currency,
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
