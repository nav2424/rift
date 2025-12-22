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
      return NextResponse.json({ error: 'Only buyer can mark as paid' }, { status: 403 })
    }

    // Check if transition to FUNDED is valid (new status system)
    // Also support legacy AWAITING_PAYMENT -> AWAITING_SHIPMENT for backward compatibility
    const canMarkPaid = 
      canTransition(rift.status, 'FUNDED', userRole) ||
      (rift.status === 'AWAITING_PAYMENT' && canTransition(rift.status, 'AWAITING_SHIPMENT', userRole))

    if (!canMarkPaid) {
      return NextResponse.json(
        { error: 'Invalid status transition. Rift must be in DRAFT or AWAITING_PAYMENT status.' },
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
      rift.sellerId,
      'PAYMENT_RECEIVED',
      `Got paid $${rift.subtotal.toFixed(2)} for ${rift.itemTitle}`,
      rift.subtotal,
      { transactionId: id }
    )

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: rift.id,
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
