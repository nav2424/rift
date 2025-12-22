/**
 * Payment processing
 * 
 * Handles payment processing for rift transactions.
 * Integrates with Stripe for payment processing.
 */

import { prisma } from './prisma'
import { createPaymentIntent, confirmPaymentIntent } from './stripe'
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

  // If payment intent ID is provided, confirm it
  if (paymentIntentId) {
    const confirmed = await confirmPaymentIntent(paymentIntentId)
    if (!confirmed) {
      throw new Error('Payment confirmation failed')
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
 * Create a payment intent for an rift
 */
export async function createEscrowPaymentIntent(transactionId: string) {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: transactionId },
    include: {
      buyer: true,
    },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  if (!rift.buyer || !rift.buyer.email) {
    throw new Error('Buyer email is required for payment intent')
  }

  const amount = rift.subtotal
  return await createPaymentIntent(
    amount,
    rift.currency,
    transactionId,
    rift.buyer.email
  )
}

