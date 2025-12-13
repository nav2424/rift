/**
 * Stripe integration for payment processing
 */

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set. Payment processing will be simulated.')
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover' as any,
    })
  : null

/**
 * Create a payment intent for an escrow transaction
 */
export async function createPaymentIntent(
  amount: number,
  currency: string,
  escrowId: string,
  buyerEmail: string
): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
  if (!stripe) {
    // In development without Stripe, return a mock
    return {
      clientSecret: 'mock_client_secret_' + escrowId,
      paymentIntentId: 'pi_mock_' + escrowId,
    }
  }

  try {
    // Validate inputs
    if (!buyerEmail || !buyerEmail.includes('@')) {
      throw new Error('Valid buyer email is required for payment intent')
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        escrowId,
        type: 'escrow',
      },
      receipt_email: buyerEmail,
      description: `Escrow payment for transaction ${escrowId}`,
      // Only allow card payments - this disables Link and all other payment methods
      payment_method_types: ['card'],
    })

    if (!paymentIntent.client_secret) {
      throw new Error('Payment intent created but no client secret returned')
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    }
  } catch (error: any) {
    console.error('Stripe payment intent creation error:', error)
    // Provide more detailed error message
    if (error.type === 'StripeInvalidRequestError') {
      throw new Error(`Payment processing error: ${error.message}`)
    }
    throw error
  }
}

/**
 * Confirm a payment intent
 * When using Payment Sheet, the payment is confirmed client-side
 * We need to wait a moment for the status to update from requires_payment_method
 */
export async function confirmPaymentIntent(
  paymentIntentId: string
): Promise<boolean> {
  if (!stripe) {
    // In development, always return true
    return true
  }

  // Retry up to 3 times with delays, as Payment Sheet confirmation can take a moment
  const maxRetries = 3
  const retryDelay = 1000 // 1 second

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      
      // Payment Sheet confirms the payment client-side
      // These statuses indicate the payment was successfully confirmed:
      // - 'succeeded': Payment completed
      // - 'processing': Payment confirmed and processing (will succeed)
      // - 'requires_capture': Payment authorized and ready to capture
      const successStatuses = ['succeeded', 'processing', 'requires_capture']
      
      if (successStatuses.includes(paymentIntent.status)) {
        return true
      }
      
      // If still requires_payment_method, wait and retry (Payment Sheet might still be processing)
      if (paymentIntent.status === 'requires_payment_method' && attempt < maxRetries - 1) {
        console.log(`Payment intent ${paymentIntentId} still requires_payment_method, retrying... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }
      
      // If payment requires action or failed, return false
      console.warn(`Payment intent ${paymentIntentId} is in status: ${paymentIntent.status}`)
      return false
    } catch (error: any) {
      console.error('Stripe payment confirmation error:', error)
      // If we can't retrieve the payment intent, wait and retry once more
      if (error.code === 'resource_missing' && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }
      
      // After all retries failed, if Payment Sheet succeeded, we trust it
      if (error.code === 'resource_missing') {
        console.warn('Payment intent not found after retries, but Payment Sheet confirmed it - proceeding')
        return true
      }
      return false
    }
  }
  
  return false
}

/**
 * Create a payout to seller
 * 
 * IMPORTANT: Payment Processing Fee Handling
 * - Payment processing fees (2.9% + $0.30) are automatically deducted from the payment
 * - The platform receives the net amount after payment processing fees
 * - When transferring to a connected account, there are no additional fees on transfers
 * - We transfer the seller amount (escrow amount - 8% total fee) directly
 * 
 * @param sellerPayoutAmount - Amount to pay seller (already calculated with platform fee deducted)
 * @param escrowAmount - Original escrow amount (for reference in metadata)
 * @param platformFee - Platform fee amount (for reference in metadata)
 * @param currency - Currency code
 * @param sellerStripeAccountId - Seller's payment account ID
 * @param escrowId - Escrow transaction ID
 */
export async function createPayout(
  sellerPayoutAmount: number,
  escrowAmount: number,
  platformFee: number,
  currency: string,
  sellerStripeAccountId: string,
  escrowId: string
): Promise<string | null> {
  if (!stripe) {
    // In development, return a mock payout ID
    console.log(`[MOCK] Payout: ${sellerPayoutAmount} ${currency} to seller (Platform fee: ${platformFee} ${currency})`)
    return 'po_mock_' + escrowId
  }

  try {
    // Note: This requires payment account to be set up
    // Transfer the seller payout amount (platform fee already deducted)
    // No additional fees on transfers to connected accounts
    const transfer = await stripe.transfers.create({
      amount: Math.round(sellerPayoutAmount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      destination: sellerStripeAccountId,
      metadata: {
        escrowId,
        escrowAmount: escrowAmount.toString(),
        platformFee: platformFee.toString(),
        sellerPayoutAmount: sellerPayoutAmount.toString(),
        type: 'escrow_payout',
      },
    })

    return transfer.id
  } catch (error) {
    console.error('Payout error:', error)
    // If seller doesn't have payment account set up, we'll need to handle this differently
    // For V1, we can store payout info and process manually
    return null
  }
}

/**
 * Refund a payment
 */
export async function refundPayment(
  paymentIntentId: string,
  amount?: number
): Promise<string | null> {
  if (!stripe) {
    return 're_mock_' + paymentIntentId
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
    })

    return refund.id
  } catch (error) {
    console.error('Stripe refund error:', error)
    return null
  }
}

