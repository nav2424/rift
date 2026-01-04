import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { transitionRiftState } from '@/lib/rift-state'
import { refundPayment } from '@/lib/stripe'
import { sendFundsReleasedEmail } from '@/lib/email'
import { DisputeResolution } from '@prisma/client'
import { debitSellerOnRefund } from '@/lib/wallet'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ riftId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { riftId: id } = await params
    const body = await request.json()
    const { resolution, partialRefundAmount, adminNotes } = body

    if (!['FULL_RELEASE', 'PARTIAL_REFUND', 'FULL_REFUND'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution. Must be "FULL_RELEASE", "PARTIAL_REFUND", or "FULL_REFUND"' },
        { status: 400 }
      )
    }

    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      include: {
        buyer: true,
        seller: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Get open disputes from Supabase
    const supabase = createServerClient()
    const { data: disputes } = await supabase
      .from('disputes')
      .select('*')
      .eq('rift_id', id)
      .eq('status', 'open')

    if (rift.status !== 'DISPUTED') {
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
      const buyerTotal = rift.subtotal + rift.buyerFee

      if (refundAmount >= buyerTotal) {
        return NextResponse.json(
          { error: 'Partial refund amount cannot exceed buyer total' },
          { status: 400 }
        )
      }

      // Refund buyer
      if (rift.stripePaymentIntentId) {
        refundId = await refundPayment(rift.stripePaymentIntentId, refundAmount)
      }

      // Debit seller wallet for refund
      await debitSellerOnRefund(id, rift.sellerId, refundAmount, rift.currency, {
        resolution: 'PARTIAL_REFUND',
        adminId: session.user.id,
      })

      // Calculate seller net after partial refund
      const sellerNetAfterRefund = (rift.sellerNet || 0) - refundAmount

      // Update rift
      await prisma.riftTransaction.update({
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
      const buyerTotal = rift.subtotal + rift.buyerFee
      refundAmount = buyerTotal

      // Refund buyer
      if (rift.stripePaymentIntentId) {
        refundId = await refundPayment(rift.stripePaymentIntentId, refundAmount)
      }

      // Debit seller wallet for full refund
      await debitSellerOnRefund(id, rift.sellerId, rift.subtotal, rift.currency, {
        resolution: 'FULL_REFUND',
        adminId: session.user.id,
      })

      // Cancel rift
      await transitionRiftState(id, 'RESOLVED', { userId: session.user.id })
      await transitionRiftState(id, 'CANCELED', { userId: session.user.id })
    }

    // Resolve all open disputes
    if (disputes && disputes.length > 0) {
      await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution: resolution.toLowerCase(),
          admin_notes: adminNotes || null,
          resolved_by: session.user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('rift_id', id)
        .eq('status', 'open')
    }

    // Create timeline event
    const resolutionMessage = 
      resolution === 'FULL_RELEASE' ? 'Admin released funds to seller' :
      resolution === 'PARTIAL_REFUND' ? `Admin partially refunded buyer ${rift.currency} ${refundAmount.toFixed(2)}` :
      `Admin fully refunded buyer ${rift.currency} ${refundAmount.toFixed(2)}`

    await prisma.timelineEvent.create({
      data: {
        id: crypto.randomUUID(),
        escrowId: id,
        type: 'DISPUTE_RESOLVED',
        message: `${resolutionMessage}. ${adminNotes ? `Note: ${adminNotes}` : ''}`,
        createdById: session.user.id,
      },
    })

    // Send email notification
    if (resolution === 'FULL_RELEASE' && rift.sellerNet) {
      await sendFundsReleasedEmail(
        rift.seller.email,
        id,
        rift.itemTitle,
        rift.sellerNet,
        rift.currency,
        rift.sellerFee
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

