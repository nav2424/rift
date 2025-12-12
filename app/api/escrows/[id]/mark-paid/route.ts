import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { processPayment } from '@/lib/payments'
import { canTransition, getUserRole } from '@/lib/rules'
import { updateBalanceOnPayment } from '@/lib/balance'
import { createActivity } from '@/lib/activity'

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
      return NextResponse.json({ error: 'Only buyer can mark as paid' }, { status: 403 })
    }

    if (!canTransition(escrow.status, 'AWAITING_SHIPMENT', userRole)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      )
    }

    // Get payment intent ID from request body if provided
    const body = await request.json().catch(() => ({}))
    const paymentIntentId = body.paymentIntentId

    // Process payment
    const paymentReference = await processPayment(id, paymentIntentId)

    // Update seller balance (instant in-app balance)
    await updateBalanceOnPayment(id)

    // Create activity for seller
    await createActivity(
      escrow.sellerId,
      'PAYMENT_RECEIVED',
      `Got paid $${escrow.amount.toFixed(2)} for ${escrow.itemTitle}`,
      escrow.amount,
      { transactionId: id }
    )

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: escrow.id,
        type: 'PAYMENT_MARKED',
        message: `Payment processed. Reference: ${paymentReference}. Awaiting shipment.`,
        createdById: auth.userId,
      },
    })

    return NextResponse.json({ success: true, paymentReference })
  } catch (error) {
    console.error('Mark paid error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
