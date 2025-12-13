import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createPaymentIntent } from '@/lib/stripe'
import { transitionRiftState } from '@/lib/rift-state'
import { calculateBuyerTotal } from '@/lib/fees'

/**
 * Fund a rift (buyer pays)
 * Creates payment intent and transitions to FUNDED state
 */
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
    const rift = await prisma.escrowTransaction.findUnique({
      where: { id },
      include: { buyer: true, seller: true },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Verify buyer
    if (rift.buyerId !== auth.userId) {
      return NextResponse.json({ error: 'Only buyer can fund this rift' }, { status: 403 })
    }

    // Verify state
    if (rift.status !== 'AWAITING_PAYMENT') {
      return NextResponse.json(
        { error: `Cannot fund rift in ${rift.status} state` },
        { status: 400 }
      )
    }

    // Calculate total buyer pays (subtotal + buyer fee)
    const buyerTotal = calculateBuyerTotal(rift.subtotal)

    // Create payment intent
    const paymentIntent = await createPaymentIntent(
      buyerTotal,
      rift.currency,
      rift.id,
      rift.buyer.email
    )

    if (!paymentIntent) {
      return NextResponse.json(
        { error: 'Failed to create payment intent' },
        { status: 500 }
      )
    }

    // Update rift with payment intent ID
    await prisma.escrowTransaction.update({
      where: { id },
      data: {
        stripePaymentIntentId: paymentIntent.paymentIntentId,
      },
    })

    // Transition to FUNDED state (after payment is confirmed)
    // Note: In production, this should be done via webhook when payment succeeds
    // For now, we'll transition immediately (webhook will handle actual confirmation)

    return NextResponse.json({
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId,
      buyerTotal,
      subtotal: rift.subtotal,
      buyerFee: rift.buyerFee,
    })
  } catch (error: any) {
    console.error('Fund rift error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Confirm payment and transition to FUNDED
 * Called after payment is confirmed (via webhook or client confirmation)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { paymentIntentId } = await request.json()

    const rift = await prisma.escrowTransaction.findUnique({
      where: { id },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    if (rift.buyerId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (rift.status !== 'AWAITING_PAYMENT') {
      return NextResponse.json(
        { error: `Cannot confirm payment in ${rift.status} state` },
        { status: 400 }
      )
    }

    // Verify payment intent matches
    if (rift.stripePaymentIntentId !== paymentIntentId) {
      return NextResponse.json({ error: 'Payment intent mismatch' }, { status: 400 })
    }

    // Transition to FUNDED
    await transitionRiftState(rift.id, 'FUNDED', { userId: auth.userId })

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: rift.id,
        type: 'PAYMENT_RECEIVED',
        message: `Payment received: ${rift.currency} ${calculateBuyerTotal(rift.subtotal).toFixed(2)} (${rift.currency} ${rift.buyerFee.toFixed(2)} fee included)`,
        createdById: auth.userId,
      },
    })

    return NextResponse.json({ success: true, status: 'FUNDED' })
  } catch (error: any) {
    console.error('Confirm payment error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
