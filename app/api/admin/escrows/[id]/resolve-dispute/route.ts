import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { transitionRiftState } from '@/lib/rift-state'
import { refundPayment } from '@/lib/stripe'
import { sendFundsReleasedEmail } from '@/lib/email'
import { DisputeResolution } from '@prisma/client'
import { debitSellerOnRefund } from '@/lib/wallet'

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
    const { resolution, partialRefundAmount, adminNotes } = body

    if (!['FULL_RELEASE', 'PARTIAL_REFUND', 'FULL_REFUND'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution. Must be "FULL_RELEASE", "PARTIAL_REFUND", or "FULL_REFUND"' },
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
        { error: 'Rift is not in disputed status' },
        { status: 400 }
      )
    }

    let refundId: string | null = null
    let refundAmount: number = 0

    // Handle different resolution types
    if (resolution === 'FULL_RELEASE') {
      // Release funds to seller (normal release flow)
      await transitionRiftState(id, 'RESOLVED', { userId: session.user.id })
      await transitionRiftState(id, 'RELEASED', { userId: session.user.id })
    } else if (resolution === 'PARTIAL_REFUND') {
      // Partial refund to buyer, release remainder to seller
      if (!partialRefundAmount || partialRefundAmount <= 0) {
        return NextResponse.json(
          { error: 'Partial refund amount is required' },
          { status: 400 }
        )
      }

      refundAmount = partialRefundAmount
      const buyerTotal = escrow.subtotal + escrow.buyerFee

      if (refundAmount >= buyerTotal) {
        return NextResponse.json(
          { error: 'Partial refund amount cannot exceed buyer total' },
          { status: 400 }
        )
      }

      // Refund buyer
      if (escrow.stripePaymentIntentId) {
        refundId = await refundPayment(escrow.stripePaymentIntentId, refundAmount)
      }

      // Debit seller wallet for refund
      await debitSellerOnRefund(id, escrow.sellerId, refundAmount, escrow.currency, {
        resolution: 'PARTIAL_REFUND',
        adminId: session.user.id,
      })

      // Calculate seller net after partial refund
      const sellerNetAfterRefund = (escrow.sellerNet || 0) - refundAmount

      // Update rift
      await prisma.escrowTransaction.update({
        where: { id },
        data: {
          sellerNet: sellerNetAfterRefund,
        },
      })

      // Release remaining to seller
      if (sellerNetAfterRefund > 0) {
        await transitionRiftState(id, 'RESOLVED', { userId: session.user.id })
        await transitionRiftState(id, 'RELEASED', { userId: session.user.id })
      } else {
        await transitionRiftState(id, 'RESOLVED', { userId: session.user.id })
        await transitionRiftState(id, 'CANCELED', { userId: session.user.id })
      }
    } else if (resolution === 'FULL_REFUND') {
      // Full refund to buyer, seller gets nothing
      const buyerTotal = escrow.subtotal + escrow.buyerFee
      refundAmount = buyerTotal

      // Refund buyer
      if (escrow.stripePaymentIntentId) {
        refundId = await refundPayment(escrow.stripePaymentIntentId, refundAmount)
      }

      // Debit seller wallet for full refund
      await debitSellerOnRefund(id, escrow.sellerId, escrow.subtotal, escrow.currency, {
        resolution: 'FULL_REFUND',
        adminId: session.user.id,
      })

      // Cancel rift
      await transitionRiftState(id, 'RESOLVED', { userId: session.user.id })
      await transitionRiftState(id, 'CANCELED', { userId: session.user.id })
    }

    // Resolve all open disputes
    if (escrow.disputes.length > 0) {
      await prisma.dispute.updateMany({
        where: {
          escrowId: id,
          status: 'OPEN',
        },
        data: {
          status: 'RESOLVED',
          resolution: resolution as DisputeResolution,
          adminNotes: adminNotes || null,
          resolvedById: session.user.id,
          resolvedAt: new Date(),
        },
      })
    }

    // Create timeline event
    const resolutionMessage = 
      resolution === 'FULL_RELEASE' ? 'Admin released funds to seller' :
      resolution === 'PARTIAL_REFUND' ? `Admin partially refunded buyer ${escrow.currency} ${refundAmount.toFixed(2)}` :
      `Admin fully refunded buyer ${escrow.currency} ${refundAmount.toFixed(2)}`

    await prisma.timelineEvent.create({
      data: {
        escrowId: id,
        type: 'DISPUTE_RESOLVED',
        message: `${resolutionMessage}. ${adminNotes ? `Note: ${adminNotes}` : ''}`,
        createdById: session.user.id,
      },
    })

    // Send email notification
    if (resolution === 'FULL_RELEASE' && escrow.sellerNet) {
      await sendFundsReleasedEmail(
        escrow.seller.email,
        id,
        escrow.itemTitle,
        escrow.sellerNet,
        escrow.currency,
        escrow.sellerFee
      )
    }

    return NextResponse.json({
      success: true,
      resolution,
      refundId,
      refundAmount,
    })
  } catch (error) {
    console.error('Resolve dispute error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

