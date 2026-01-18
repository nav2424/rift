import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createEscrowPaymentIntent } from '@/lib/payments'

/**
 * Create payment intent for a Rift
 * ✅ Now uses the same consistent function as /fund endpoint
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
    const result = await createEscrowPaymentIntent(id)

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create payment intent. Payment processing may not be configured.' },
        { status: 500 }
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Create payment intent error:', error)
    if (error?.message?.includes('AWAITING_PAYMENT')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
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

