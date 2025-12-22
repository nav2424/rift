import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { getUserRole } from '@/lib/rules'
import { createEscrowPaymentIntent } from '@/lib/payments'

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
        { error: 'Only buyer can create payment intent' },
        { status: 403 }
      )
    }

    if (rift.status !== 'AWAITING_PAYMENT') {
      return NextResponse.json(
        { error: 'Rift must be in AWAITING_PAYMENT status' },
        { status: 400 }
      )
    }

    const paymentIntent = await createEscrowPaymentIntent(id)

    if (!paymentIntent) {
      return NextResponse.json(
        { error: 'Failed to create payment intent. Payment processing may not be configured.' },
        { status: 500 }
      )
    }

    return NextResponse.json(paymentIntent)
  } catch (error: any) {
    console.error('Create payment intent error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

