import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canTransition } from '@/lib/rules'
import { createPayout, refundPayment } from '@/lib/stripe'
import { sendFundsReleasedEmail } from '@/lib/email'
import { calculatePlatformFee, calculateSellerPayout, roundCurrency, getFeeBreakdown } from '@/lib/fees'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const body = await request.json()
    const { action, adminNote } = body

    if (!['release', 'refund'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "release" or "refund"' },
        { status: 400 }
      )
    }

    const escrow = await prisma.escrowTransaction.findUnique({
      where: { id },
      include: {
        buyer: true,
        seller: true,
        disputes: {
          where: { status: 'OPEN' },
        },
      },
    })

    if (!escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    if (escrow.status !== 'DISPUTED') {
      return NextResponse.json(
        { error: 'Escrow is not in disputed status' },
        { status: 400 }
      )
    }

    const newStatus = action === 'release' ? 'RELEASED' : 'REFUNDED'

    if (!canTransition(escrow.status, newStatus, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      )
    }

    // Process payout or refund
    let payoutId: string | null = null
    let refundId: string | null = null
    let platformFee: number | undefined
    let sellerPayoutAmount: number | undefined

    if (action === 'release' && escrow.paymentReference) {
      // Calculate fees and seller payout amount
      // Total fee is 8% (includes platform fee + Stripe fees, all paid by seller)
      // Payment processing fees (2.9% + $0.30) are automatically deducted by Stripe, included in 8% total
      const feeBreakdown = getFeeBreakdown(escrow.amount)
      platformFee = roundCurrency(feeBreakdown.platformFee)
      sellerPayoutAmount = roundCurrency(feeBreakdown.sellerReceives)

      // Extract payment intent ID from payment reference if available
      const paymentIntentId = escrow.paymentReference.includes('pi_')
        ? escrow.paymentReference
        : null

      // For V1, we'll attempt payout if seller has payment account connected
      const sellerStripeAccountId = (escrow.seller as any).stripeAccountId
      if (sellerStripeAccountId) {
        payoutId = await createPayout(
          sellerPayoutAmount,
          escrow.amount,
          platformFee,
          escrow.currency,
          sellerStripeAccountId,
          id
        )
      }
    } else if (action === 'refund' && escrow.paymentReference) {
      // Extract payment intent ID and refund
      const paymentIntentId = escrow.paymentReference.includes('pi_')
        ? escrow.paymentReference
        : null

      if (paymentIntentId) {
        refundId = await refundPayment(paymentIntentId, escrow.amount)
      }
    }

    // Update escrow status and store fee information
    await prisma.escrowTransaction.update({
      where: { id },
      data: {
        status: newStatus,
        ...(action === 'release' && platformFee && sellerPayoutAmount ? {
          platformFee,
          sellerPayoutAmount,
        } : {}),
        paymentReference: payoutId
          ? `${escrow.paymentReference} | Payout: ${payoutId}`
          : refundId
          ? `${escrow.paymentReference} | Refund: ${refundId}`
          : escrow.paymentReference,
      },
    })

    // Resolve all open disputes
    if (escrow.disputes.length > 0) {
      await prisma.dispute.updateMany({
        where: {
          escrowId: id,
          status: 'OPEN',
        },
        data: {
          status: 'RESOLVED',
          adminNote: adminNote || null,
          resolvedById: session.user.id,
        },
      })
    }

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: id,
        type: action === 'release' ? 'ADMIN_RELEASED' : 'ADMIN_REFUNDED',
        message: `Admin ${action === 'release' ? 'released funds to seller' : 'refunded buyer'}. ${adminNote ? `Note: ${adminNote}` : ''}`,
        createdById: session.user.id,
      },
    })

    // Send email notification with fee breakdown
    if (action === 'release' && sellerPayoutAmount && platformFee) {
      await sendFundsReleasedEmail(
        escrow.seller.email,
        id,
        escrow.itemTitle,
        sellerPayoutAmount, // Amount seller actually receives
        escrow.currency,
        platformFee // Include platform fee for transparency
      )
    }

    return NextResponse.json({
      success: true,
      newStatus,
      payoutId,
      refundId,
    })
  } catch (error) {
    console.error('Resolve dispute error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

