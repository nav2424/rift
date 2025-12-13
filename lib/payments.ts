/**
 * Payment processing
 * 
 * Handles payment processing for escrow transactions.
 * Integrates with Stripe for payment processing.
 */

import { prisma } from './prisma'
import { createPaymentIntent, confirmPaymentIntent } from './stripe'
import { sendPaymentReceivedEmail } from './email'

export async function processPayment(
  transactionId: string,
  paymentIntentId?: string
): Promise<string> {
  const escrow = await prisma.escrowTransaction.findUnique({
    where: { id: transactionId },
    include: {
      buyer: true,
      seller: true,
    },
  })

  if (!escrow) {
    throw new Error('Escrow not found')
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
  
  // Update the transaction with the payment reference
  await prisma.escrowTransaction.update({
    where: { id: transactionId },
    data: {
      paymentReference,
      status: 'AWAITING_SHIPMENT',
    },
  })

  // Send email notification
  const amount = escrow.amount ?? escrow.subtotal
  await sendPaymentReceivedEmail(
    escrow.seller.email,
    transactionId,
    escrow.itemTitle,
    amount,
    escrow.currency
  )
  
  return paymentReference
}

/**
 * Create a payment intent for an escrow
 */
export async function createEscrowPaymentIntent(transactionId: string) {
  const escrow = await prisma.escrowTransaction.findUnique({
    where: { id: transactionId },
    include: {
      buyer: true,
    },
  })

  if (!escrow) {
    throw new Error('Escrow not found')
  }

  if (!escrow.buyer || !escrow.buyer.email) {
    throw new Error('Buyer email is required for payment intent')
  }

  const amount = escrow.amount ?? escrow.subtotal
  return await createPaymentIntent(
    amount,
    escrow.currency,
    transactionId,
    escrow.buyer.email
  )
}

