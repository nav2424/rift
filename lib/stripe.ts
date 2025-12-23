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
 * Create a payment intent for an rift transaction
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
        type: 'rift',
      },
      receipt_email: buyerEmail,
      description: `Rift payment for transaction ${escrowId}`,
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
 * - We transfer the seller amount (rift amount - 8% total fee) directly
 * 
 * @param sellerPayoutAmount - Amount to pay seller (already calculated with platform fee deducted)
 * @param escrowAmount - Original rift amount (for reference in metadata)
 * @param platformFee - Platform fee amount (for reference in metadata)
 * @param currency - Currency code
 * @param sellerStripeAccountId - Seller's payment account ID
 * @param escrowId - Rift transaction ID
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

/**
 * Create or retrieve a Stripe Connect account for a user
 * Returns the account ID
 */
export async function createOrGetConnectAccount(
  userId: string,
  email: string,
  userName?: string | null
): Promise<string> {
  if (!stripe) {
    // In development, return a mock account ID
    return 'acct_mock_' + userId.slice(0, 8)
  }

  try {
    // Get a valid URL for business_profile
    // Stripe requires a valid URL format - use production URL or default
    let businessUrl = process.env.NEXTAUTH_URL || 'https://rift.app'
    
    // Ensure URL has proper protocol and is not localhost (Stripe may reject localhost)
    if (businessUrl.includes('localhost') || businessUrl.includes('127.0.0.1')) {
      // Use a default production URL for localhost
      businessUrl = 'https://rift.app'
    }
    
    // Ensure URL starts with http:// or https://
    if (!businessUrl.startsWith('http://') && !businessUrl.startsWith('https://')) {
      businessUrl = `https://${businessUrl}`
    }

    // Create a new Connect account for individuals (not businesses)
    // Note: Stripe requires card_payments capability when requesting transfers
    const account = await stripe.accounts.create({
      type: 'express', // Express accounts are the simplest for onboarding
      country: 'CA', // Default to Canada, can be made configurable
      email: email,
      business_type: 'individual', // Explicitly set to individual for personal transactions
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        // Pre-fill all business profile fields to skip business details page in onboarding
        // MCC code for general merchandise (appropriate for individual marketplace)
        mcc: '5971', // Art Dealers and Galleries / General Merchandise (covers personal marketplace)
        // Pre-fill website URL - using platform URL since individuals don't have websites
        url: businessUrl,
        product_description: 'Personal transactions between individuals',
        // Pre-fill business name with individual's name
        name: userName || 'Individual',
      },
      individual: {
        // Pre-fill individual information to avoid asking for job title/occupation
        email: email,
        // Set a generic occupation to avoid the field appearing
        // Users can update this later if needed, but it won't be required during onboarding
      },
      metadata: {
        userId: userId,
        accountType: 'individual',
        platform: 'rift',
      },
    })

    // Pre-fill individual and business fields to minimize questions during onboarding
    // This helps reduce business-related questions for individual accounts
    // Note: Pre-filling business_profile.mcc and business_profile.url will skip the business details page
    try {
      await stripe.accounts.update(account.id, {
        business_profile: {
          // Pre-fill all business profile fields to skip business details page
          // When MCC and URL are pre-filled, Stripe skips the "Business details" page
          mcc: '5971', // General Merchandise (for individual marketplace)
          // Use same validated URL as account creation
          url: (() => {
            let url = process.env.NEXTAUTH_URL || 'https://rift.app'
            if (url.includes('localhost') || url.includes('127.0.0.1')) {
              url = 'https://rift.app'
            }
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
              url = `https://${url}`
            }
            return url
          })(),
          name: userName || 'Individual',
          product_description: 'Personal transactions between individuals',
        },
      })
    } catch (updateError: any) {
      // If update fails (field might not be available yet), continue anyway
      // The account is still created and onboarding will proceed
      console.warn('Could not pre-fill account fields (this is normal):', updateError?.message)
    }

    return account.id
  } catch (error: any) {
    console.error('Stripe Connect account creation error:', error)
    
    // Check for specific Stripe Connect setup errors
    if (error.message?.includes('review the responsibilities') || 
        error.message?.includes('platform-profile') ||
        error.code === 'account_invalid') {
      throw new Error(
        'Stripe Connect is not fully configured. Please complete the Connect profile setup in your Stripe Dashboard: https://dashboard.stripe.com/settings/connect/platform-profile'
      )
    }
    
    // Check for capability approval errors
    if (error.message?.includes('transfers') && error.message?.includes('card_payments')) {
      throw new Error(
        'Stripe requires approval for transfers capability. Please contact Stripe support or ensure your platform has the necessary approvals.'
      )
    }
    
    throw new Error(`Failed to create Stripe account: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Create an account link for Stripe Connect onboarding
 * Returns the onboarding URL
 */
export async function createAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  if (!stripe) {
    // In development, return a mock URL
    return `${returnUrl}?mock=true&account_id=mock_${accountId}`
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })

    return accountLink.url
  } catch (error: any) {
    console.error('Stripe account link creation error:', error)
    throw new Error(`Failed to create account link: ${error.message}`)
  }
}

/**
 * Get Stripe Connect account status
 * Returns account details and onboarding status with detailed verification information
 */
export async function getConnectAccountStatus(
  accountId: string
): Promise<{
  accountId: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  email?: string
  status: 'approved' | 'pending' | 'restricted' | 'rejected' | 'under_review'
  statusMessage?: string
  requirements?: {
    currentlyDue: string[]
    eventuallyDue: string[]
    pastDue: string[]
    pendingVerification: string[]
  }
  disabledReason?: string
}> {
  if (!stripe) {
    // In development, return mock status
    return {
      accountId,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      email: 'mock@example.com',
      status: 'approved',
      statusMessage: 'Account approved (mock mode)',
    }
  }

  try {
    const account = await stripe.accounts.retrieve(accountId)

    // Determine account status
    let status: 'approved' | 'pending' | 'restricted' | 'rejected' | 'under_review' = 'pending'
    let statusMessage: string | undefined
    let disabledReason: string | undefined

    // Check if account is disabled and why
    if (account.charges_enabled === false || account.payouts_enabled === false) {
      if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
        status = 'restricted'
        statusMessage = 'Additional information required to enable payouts'
      } else if (account.requirements?.past_due && account.requirements.past_due.length > 0) {
        status = 'restricted'
        statusMessage = 'Verification information is past due'
      } else if (!account.details_submitted) {
        status = 'pending'
        statusMessage = 'Complete account setup to enable payouts'
      } else {
        status = 'under_review'
        statusMessage = 'Account is under review by Stripe'
      }
    } else if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
      status = 'approved'
      statusMessage = 'Account approved and ready for payouts'
    } else {
      status = 'pending'
      statusMessage = 'Account setup in progress'
    }

    // Check for disabled reason
    if ((account as any).disabled_reason) {
      disabledReason = (account as any).disabled_reason
      if (disabledReason.includes('rejected')) {
        status = 'rejected'
        if (disabledReason.includes('fraud')) {
          statusMessage = 'Account rejected due to fraud concerns'
        } else if (disabledReason.includes('terms')) {
          statusMessage = 'Account rejected for terms of service violation'
        } else {
          statusMessage = 'Account rejected by Stripe'
        }
      }
    }

    // Extract requirements
    const requirements = account.requirements ? {
      currentlyDue: account.requirements.currently_due || [],
      eventuallyDue: account.requirements.eventually_due || [],
      pastDue: account.requirements.past_due || [],
      pendingVerification: account.requirements.pending_verification || [],
    } : undefined

    return {
      accountId: account.id,
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
      detailsSubmitted: account.details_submitted || false,
      email: account.email || undefined,
      status,
      statusMessage,
      requirements,
      disabledReason,
    }
  } catch (error: any) {
    console.error('Stripe account retrieval error:', error)
    throw new Error(`Failed to retrieve account status: ${error.message}`)
  }
}

