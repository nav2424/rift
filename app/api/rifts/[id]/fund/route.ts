import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createEscrowPaymentIntent } from '@/lib/payments'

/**
 * Pay for a rift (buyer pays)
 * Creates payment intent - both endpoints now use the same consistent function
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
    
    // Verify the user is the buyer
    const { prisma } = await import('@/lib/prisma')
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      select: { buyerId: true, status: true },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    if (rift.buyerId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (rift.status !== 'AWAITING_PAYMENT') {
      return NextResponse.json(
        { error: `Rift is in ${rift.status} status. Cannot create payment intent.` },
        { status: 400 }
      )
    }

    const result = await createEscrowPaymentIntent(id)
    
    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create payment intent' },
        { status: 500 }
      )
    }

    // Store the payment intent ID in the database
    try {
      await prisma.riftTransaction.update({
        where: { id },
        data: {
          stripePaymentIntentId: result.paymentIntentId,
        },
      })
    } catch (updateError: any) {
      console.error('Failed to store payment intent ID:', updateError)
      // Non-critical - continue and return the result
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Create payment intent error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


/**
 * Confirm payment and transition to PAID
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
    
    let paymentIntentId: string
    try {
      const body = await request.json()
      paymentIntentId = body.paymentIntentId
      if (!paymentIntentId) {
        return NextResponse.json({ 
          error: 'Payment intent ID is required',
          details: 'The paymentIntentId field is missing from the request body'
        }, { status: 400 })
      }
    } catch (parseError: any) {
      return NextResponse.json({ 
        error: 'Invalid request body',
        details: parseError.message || 'Failed to parse request body'
      }, { status: 400 })
    }

    const { prisma } = await import('@/lib/prisma')
    const { stripe } = await import('@/lib/stripe')
    const { transitionRiftState } = await import('@/lib/rift-state')
    const { randomUUID } = await import('crypto')
    const { createActivity } = await import('@/lib/activity')

    const rift = await prisma.riftTransaction.findUnique({
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

    // Verify payment intent matches (if stored)
    // If not stored yet, we'll verify via Stripe API instead
    if (rift.stripePaymentIntentId && rift.stripePaymentIntentId !== paymentIntentId) {
      console.error('Payment intent mismatch:', {
        stored: rift.stripePaymentIntentId,
        provided: paymentIntentId
      })
      return NextResponse.json({ 
        error: 'Payment intent mismatch',
        details: 'The payment intent ID does not match the stored value'
      }, { status: 400 })
    }

    // Verify payment intent status with Stripe (if Stripe is configured)
    // Also verify the payment intent belongs to this rift
    if (stripe) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
        
        // Verify this payment intent belongs to this rift
        const paymentRiftId = paymentIntent.metadata?.escrowId
        if (paymentRiftId && paymentRiftId !== id) {
          console.error('Payment intent belongs to different rift:', {
            paymentIntentId,
            expectedRiftId: id,
            actualRiftId: paymentRiftId
          })
          return NextResponse.json({ 
            error: 'Payment intent mismatch',
            details: 'This payment intent belongs to a different rift'
          }, { status: 400 })
        }
        
        // Accept succeeded, processing, or requires_capture as valid states
        const validStatuses = ['succeeded', 'processing', 'requires_capture']
        
        if (!validStatuses.includes(paymentIntent.status)) {
          console.error('Payment intent not in valid state:', {
            paymentIntentId,
            status: paymentIntent.status,
            lastPaymentError: paymentIntent.last_payment_error
          })
          
          return NextResponse.json({ 
            error: `Payment not completed. Status: ${paymentIntent.status}`,
            details: paymentIntent.last_payment_error?.message || `Payment intent is in ${paymentIntent.status} state, expected succeeded/processing/requires_capture`
          }, { status: 400 })
        }

        // Update stored payment intent ID if it wasn't stored before
        if (!rift.stripePaymentIntentId) {
          try {
            await prisma.riftTransaction.update({
              where: { id },
              data: {
                stripePaymentIntentId: paymentIntentId,
              },
            })
          } catch (updateError) {
            console.warn('Failed to store payment intent ID after verification:', updateError)
            // Non-critical - continue
          }
        }
      } catch (stripeError: any) {
        console.error('Stripe payment intent retrieval error:', stripeError)
        return NextResponse.json({ 
          error: 'Failed to verify payment with Stripe',
          details: stripeError.message || 'Could not retrieve payment intent status'
        }, { status: 500 })
      }
    }

    // Transition to PAID
    try {
      await transitionRiftState(rift.id, 'FUNDED', { userId: auth.userId })
    } catch (transitionError: any) {
      console.error('State transition error:', transitionError)
      return NextResponse.json({
        error: 'Failed to update rift status',
        details: transitionError.message || 'State transition failed'
      }, { status: 500 })
    }

    // Create timeline event
    // Show only the rift value (what the item is worth) - no fee information
    const riftValue = rift.subtotal ?? 0
    
    try {
      if (riftValue === 0) {
        console.warn(`Rift ${rift.id} has no subtotal set, cannot create accurate timeline event`)
        await prisma.timelineEvent.create({
          data: {
            id: randomUUID(),
            escrowId: rift.id,
            type: 'PAYMENT_RECEIVED',
            message: 'Payment received',
            createdById: auth.userId,
          },
        })
      } else {
        // Simple message with just the rift value - no fees
        const message = `Payment received: ${rift.currency} ${riftValue.toFixed(2)}`
        
        await prisma.timelineEvent.create({
          data: {
            id: randomUUID(),
            escrowId: rift.id,
            type: 'PAYMENT_RECEIVED',
            message,
            createdById: auth.userId,
          },
        })
      }
    } catch (timelineError: any) {
      // Log but don't fail the request if timeline event creation fails
      console.error('Timeline event creation error:', timelineError)
    }

    // Create activity for both buyer and seller
    try {
      const riftWithDetails = await prisma.riftTransaction.findUnique({
        where: { id: rift.id },
        include: {
          buyer: { select: { name: true, email: true } },
          seller: { select: { name: true, email: true } },
        },
      })

      if (riftWithDetails) {
        const buyerName = riftWithDetails.buyer.name || riftWithDetails.buyer.email.split('@')[0]
        const sellerName = riftWithDetails.seller.name || riftWithDetails.seller.email.split('@')[0]

        // Activity for buyer
        await createActivity(
          rift.buyerId,
          'RIFT_PAID',
          `Paid for rift #${riftWithDetails.riftNumber} - ${riftWithDetails.itemTitle}`,
          riftValue,
          { transactionId: rift.id, riftNumber: riftWithDetails.riftNumber, currency: rift.currency }
        )

        // Activity for seller
        await createActivity(
          rift.sellerId,
          'PAYMENT_RECEIVED',
          `Payment received for rift #${riftWithDetails.riftNumber} - ${riftWithDetails.itemTitle} from ${buyerName}`,
          riftValue,
          { transactionId: rift.id, riftNumber: riftWithDetails.riftNumber, currency: rift.currency, buyerId: rift.buyerId }
        )
      }
    } catch (error) {
      console.error('Failed to create activity (non-critical):', error)
      // Non-critical - continue
    }

    return NextResponse.json({ success: true, status: 'FUNDED' })
  } catch (error: any) {
    console.error('Confirm payment error:', error)
    const errorMessage = error?.message || error?.toString() || 'Internal server error'
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? (error?.stack || errorMessage)
      : 'An unexpected error occurred while processing payment'
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    )
  }
}
