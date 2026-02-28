/**
 * Payment processing
 * 
 * Handles payment processing for rift transactions.
 * Integrates with Stripe for payment processing.
 */

import { prisma } from './prisma'
import { createRiftPaymentIntent, confirmPaymentIntent } from './stripe'
import { sendPaymentReceivedEmail } from './email'

export async function processPayment(
  transactionId: string,
  paymentIntentId?: string
): Promise<string> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: transactionId },
    include: {
      buyer: true,
      seller: true,
    },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  if (rift.status !== 'AWAITING_PAYMENT') {
    throw new Error('Rift must be in AWAITING_PAYMENT status')
  }

  // If payment intent ID is provided, confirm it
  if (paymentIntentId) {
    const confirmed = await confirmPaymentIntent(paymentIntentId)
    if (!confirmed) {
      throw new Error('Payment confirmation failed')
    }
  }

  // Verify payment amount matches rift total
  if (paymentIntentId) {
    try {
      const { stripe: stripeClient } = await import('./stripe')
      if (stripeClient) {
        const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId)
        const { calculateBuyerFee } = await import('./fees')
        const expectedBuyerFee = calculateBuyerFee(rift.subtotal)
        const expectedAmountCents = Math.round((rift.subtotal + expectedBuyerFee) * 100)
        if (Math.abs(pi.amount - expectedAmountCents) > 1) {
          throw new Error(`Payment amount mismatch: expected ${expectedAmountCents} cents, got ${pi.amount} cents`)
        }
      }
    } catch (verifyError: any) {
      if (verifyError.message?.includes('Payment amount mismatch')) throw verifyError
      // If Stripe is unavailable in dev, continue
    }
  }

  // Generate a payment reference
  const paymentReference = paymentIntentId || `PAY-${transactionId.slice(0, 8).toUpperCase()}`
  
  // Update the transaction with the payment reference and set to FUNDED
  await prisma.riftTransaction.update({
    where: { id: transactionId },
    data: {
      paymentReference,
      status: 'FUNDED',
      fundedAt: new Date(),
    },
  })

  // Send email notification
  const amount = rift.subtotal
  await sendPaymentReceivedEmail(
    rift.seller.email,
    transactionId,
    rift.itemTitle,
    amount,
    rift.currency
  )
  
  return paymentReference
}

/**
 * Create a payment intent for a Rift transaction
 * ✅ Always uses subtotal, let stripe.ts compute buyerTotal + metadata breakdown
 * Checks for existing payment intent before creating a new one
 */
export async function createEscrowPaymentIntent(transactionId: string) {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      status: true,
      subtotal: true,
      currency: true,
      buyerId: true,
      buyer: {
        select: {
          email: true,
        },
      },
      stripePaymentIntentId: true,
    },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  if (rift.status !== 'AWAITING_PAYMENT') {
    throw new Error('Rift must be in AWAITING_PAYMENT status')
  }

  if (!rift.buyer?.email) {
    throw new Error('Buyer email is required for payment intent')
  }

  // Check if payment intent already exists in database
  if (rift.stripePaymentIntentId) {
    const { stripe } = await import('./stripe')
    if (stripe) {
      try {
        const existingPi = await stripe.paymentIntents.retrieve(rift.stripePaymentIntentId)
        if (existingPi && existingPi.client_secret) {
          console.log(`Using existing payment intent ${rift.stripePaymentIntentId} for rift ${transactionId}`)
          return { 
            clientSecret: existingPi.client_secret, 
            paymentIntentId: existingPi.id 
          }
        }
      } catch (retrieveError: any) {
        // If retrieval fails (e.g., payment intent doesn't exist or was deleted), continue to create new one
        console.warn(`Could not retrieve existing payment intent ${rift.stripePaymentIntentId}:`, retrieveError.message)
        // Continue to create a new payment intent
      }
    }
  }

  // ✅ Always use subtotal, let stripe.ts compute buyerTotal + metadata breakdown
  return await createRiftPaymentIntent({
    subtotal: rift.subtotal,
    currency: rift.currency,
    riftId: rift.id,
    buyerEmail: rift.buyer.email,
  })
}

