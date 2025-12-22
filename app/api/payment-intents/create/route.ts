import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createEscrowPaymentIntent } from '@/lib/payments'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { escrowId } = body

    if (!escrowId) {
      return NextResponse.json(
        { error: 'Rift ID is required' },
        { status: 400 }
      )
    }

    // Verify the rift exists and user is the buyer
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: escrowId },
      include: {
        buyer: true,
      },
    })

    if (!rift) {
      return NextResponse.json(
        { error: 'Rift not found' },
        { status: 404 }
      )
    }

    if (rift.buyerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the buyer can create a payment intent' },
        { status: 403 }
      )
    }

    if (rift.status !== 'AWAITING_PAYMENT') {
      return NextResponse.json(
        { error: 'Rift is not in AWAITING_PAYMENT status' },
        { status: 400 }
      )
    }

    // Create payment intent
    const paymentIntent = await createEscrowPaymentIntent(escrowId)

    if (!paymentIntent) {
      return NextResponse.json(
        { error: 'Failed to create payment intent' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId,
    })
  } catch (error: any) {
    console.error('Create payment intent error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

