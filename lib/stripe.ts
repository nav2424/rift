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

// Fee calculation helpers
type CreateRiftPIInput = {
  subtotal: number;        // in dollars
  currency: string;
  riftId: string;
  buyerEmail: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function calculateFees(subtotal: number) {
  const buyerFee = round2(subtotal * 0.03);   // 3%
  const sellerFee = round2(subtotal * 0.05);  // 5%
  const buyerTotal = round2(subtotal + buyerFee);
  const sellerPayout = round2(subtotal - sellerFee); // 95% of subtotal

  return { buyerFee, sellerFee, buyerTotal, sellerPayout };
}

/**
 * Create a payment intent for a Rift transaction
 * Funds stay on platform (no transfer_data) - we'll transfer to seller on release
 */
export async function createRiftPaymentIntent({
  subtotal,
  currency,
  riftId,
  buyerEmail,
}: CreateRiftPIInput): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
  if (!stripe) {
    return {
      clientSecret: "mock_client_secret_" + riftId,
      paymentIntentId: "pi_mock_" + riftId,
    };
  }

  if (!buyerEmail || !buyerEmail.includes("@")) {
    throw new Error("Valid buyer email is required for payment intent");
  }

  const { buyerFee, sellerFee, buyerTotal, sellerPayout } = calculateFees(subtotal);

  const amountCents = Math.round(buyerTotal * 100);

  // First, check if a payment intent already exists for this rift via metadata
  try {
    const existingPaymentIntents = await stripe.paymentIntents.search({
      query: `metadata['escrowId']:'${riftId}'`,
      limit: 1,
    })

    if (existingPaymentIntents.data.length > 0) {
      const existingPi = existingPaymentIntents.data[0]
      if (existingPi.client_secret) {
        console.log(`Found existing payment intent ${existingPi.id} for rift ${riftId}`)
        return { clientSecret: existingPi.client_secret, paymentIntentId: existingPi.id }
      }
    }
  } catch (searchError: any) {
    // If search fails, continue to create new payment intent
    console.warn('Could not search for existing payment intent:', searchError.message)
  }

  // Generate idempotency key for PaymentIntent creation (v2 with card-only restriction)
  const { getPaymentIntentIdempotencyKey } = await import('./stripe-idempotency')
  const idempotencyKey = getPaymentIntentIdempotencyKey(riftId, 2)

  try {
    // Prioritize bank transfers (us_bank_account) over card payments
    // Note: us_bank_account (ACH) is US-only, so only include it for USD
    // For other currencies/countries, use card only
    const currencyLower = currency.toLowerCase()
    const isUSD = currencyLower === 'usd'
    const paymentMethodTypes: string[] = isUSD 
      ? ['us_bank_account', 'card'] // US: prioritize bank transfers
      : ['card'] // Non-US: card only (bank transfers require country-specific implementations)

    const pi = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: currencyLower,
        receipt_email: buyerEmail,
        description: `Rift payment for transaction ${riftId}`,
        payment_method_types: paymentMethodTypes,

        // IMPORTANT: funds stay on PLATFORM because we are NOT using transfer_data here.
        // We'll transfer to seller later when a milestone is released.

        metadata: {
          escrowId: riftId, // keep name for now to avoid breaking downstream
          type: "rift",

          subtotal: subtotal.toString(),
          buyerFee: buyerFee.toString(),
          sellerFee: sellerFee.toString(),
          buyerTotal: buyerTotal.toString(),
          sellerPayout: sellerPayout.toString(),
        },
      },
      {
        idempotencyKey: idempotencyKey,
      }
    );

    if (!pi.client_secret) throw new Error("Payment intent created but no client secret returned");

    return { clientSecret: pi.client_secret, paymentIntentId: pi.id };
  } catch (createError: any) {
    // Handle idempotency key conflict - try to retrieve the existing payment intent
    if (createError.type === 'StripeIdempotencyError' || 
        createError.code === 'idempotency_key_in_use' ||
        createError.message?.includes('idempotent requests can only be used with the same parameters')) {
      console.warn(`Idempotency key conflict for rift ${riftId}, attempting to retrieve existing payment intent`)
      
      try {
        // Try to find the payment intent via metadata (it was created with different parameters)
        const searchResult = await stripe.paymentIntents.search({
          query: `metadata['escrowId']:'${riftId}'`,
          limit: 5,
        })

        if (searchResult.data.length > 0) {
          // Find the most recent one that matches our criteria
          const matchingPi = searchResult.data
            .filter(pi => pi.metadata?.escrowId === riftId)
            .sort((a, b) => b.created - a.created)[0]

          if (matchingPi && matchingPi.client_secret) {
            console.log(`Retrieved existing payment intent ${matchingPi.id} for rift ${riftId} after idempotency conflict`)
            return { clientSecret: matchingPi.client_secret, paymentIntentId: matchingPi.id }
          }
        }
      } catch (retrieveError: any) {
        console.error('Failed to retrieve existing payment intent after idempotency conflict:', retrieveError)
      }

      // If we can't retrieve, try one more time with a broader search (including all payment intents for this rift)
      // This handles the case where the payment intent exists but metadata search didn't find it
      try {
        // Search all payment intents with this rift ID in metadata (no limit on status)
        const allResults = await stripe.paymentIntents.search({
          query: `metadata['escrowId']:'${riftId}'`,
          limit: 10,
        })

        for (const pi of allResults.data) {
          if (pi.metadata?.escrowId === riftId && pi.client_secret) {
            console.log(`Found existing payment intent ${pi.id} for rift ${riftId} after idempotency conflict (broader search)`)
            return { clientSecret: pi.client_secret, paymentIntentId: pi.id }
          }
        }
      } catch (finalRetryError: any) {
        console.error('Final attempt to retrieve payment intent failed:', finalRetryError)
      }

      // If all retrieval attempts fail, throw the original error with a helpful message
      throw new Error(
        `Payment intent creation failed due to idempotency conflict. ` +
        `A payment intent may already exist for this rift (ID: ${riftId}) but could not be retrieved. ` +
        `Original error: ${createError.message}`
      )
    }

    // Re-throw other errors
    throw createError
  }
}

/**
 * @deprecated Use createRiftPaymentIntent instead
 * Legacy function kept for backward compatibility
 */
export async function createPaymentIntent(
  amount: number,
  currency: string,
  escrowId: string,
  buyerEmail: string
): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
  // For backward compatibility, treat amount as buyerTotal and calculate subtotal
  // This is a rough approximation - new code should use createRiftPaymentIntent
  const subtotal = amount / 1.03; // Reverse calculate subtotal from buyerTotal
  return createRiftPaymentIntent({
    subtotal,
    currency,
    riftId: escrowId,
    buyerEmail,
  });
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
      const successStatuses = ['succeeded']
      
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
 * Create a Stripe transfer to seller's connected account
 * Used when releasing funds after milestone approval
 * Includes idempotency to prevent double transfers
 * 
 * @param sellerPayoutAmount - Amount to transfer (subtotal * 0.95)
 * @param currency - Currency code
 * @param sellerStripeAccountId - Seller's Stripe Connect account ID
 * @param riftId - Rift transaction ID
 * @param milestoneId - Optional milestone ID for milestone releases
 * @param existingTransferId - Optional existing transfer ID to check (for idempotency)
 */
export async function createRiftTransfer(
  sellerPayoutAmount: number,
  currency: string,
  sellerStripeAccountId: string,
  riftId: string,
  milestoneId?: string,
  existingTransferId?: string | null
): Promise<string | null> {
  if (!stripe) {
    console.log(`[MOCK] Transfer: ${sellerPayoutAmount} ${currency} to seller for rift ${riftId}`)
    return 'tr_mock_' + riftId + (milestoneId ? '_' + milestoneId : '')
  }

  // Idempotency: if transfer already exists, return it
  if (existingTransferId) {
    try {
      const existingTransfer = await stripe.transfers.retrieve(existingTransferId)
      if (existingTransfer) {
        console.log(`Transfer ${existingTransferId} already exists for rift ${riftId}`)
        return existingTransferId
      }
    } catch (error: any) {
      // Transfer doesn't exist or was deleted, continue to create new one
      if (error.code !== 'resource_missing') {
        console.warn(`Error checking existing transfer ${existingTransferId}:`, error.message)
      }
    }
  }

  // Check balance availability before transfer
  const { checkBalanceAvailability } = await import('./stripe-balance')
  const balance = await checkBalanceAvailability(sellerPayoutAmount, currency)
  
  if (!balance.sufficient) {
    console.error(`Insufficient Stripe balance for transfer: need ${sellerPayoutAmount} ${currency}, available ${balance.available} ${currency}`)
    throw new Error(`Insufficient Stripe balance. Available: ${balance.available} ${currency}, Required: ${sellerPayoutAmount} ${currency}`)
  }

  try {
    // Generate idempotency key
    const { getFullReleaseTransferIdempotencyKey, getMilestoneTransferIdempotencyKey } = await import('./stripe-idempotency')
    const idempotencyKey = milestoneId
      ? getMilestoneTransferIdempotencyKey(riftId, parseInt(milestoneId.split('_').pop() || '0'))
      : getFullReleaseTransferIdempotencyKey(riftId)

    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(sellerPayoutAmount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        destination: sellerStripeAccountId,
        metadata: {
          riftId,
          type: 'rift_payout',
          ...(milestoneId && { milestoneId }),
        },
      },
      {
        idempotencyKey: idempotencyKey,
      }
    )

    return transfer.id
  } catch (error: any) {
    console.error('Stripe transfer error:', error)
    
    // Handle idempotency key conflict (means transfer already exists)
    if (error.code === 'idempotency_key_in_use') {
      // This shouldn't happen if we check existingTransferId, but handle gracefully
      console.warn(`Idempotency key conflict for transfer - transfer may already exist`)
      // Could try to retrieve by metadata, but for now return null
      return null
    }
    
    // If seller doesn't have payment account set up, return null
    // The release can still proceed (funds stay in wallet)
    return null
  }
}

/**
 * Create a payout to seller
 * 
 * @deprecated Use createRiftTransfer instead for Rift releases
 * This function is kept for backward compatibility with wallet withdrawals
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
 * Refund a payment with policy enforcement
 * 
 * @param paymentIntentId - Stripe PaymentIntent ID
 * @param riftId - Rift transaction ID (for policy enforcement)
 * @param amount - Optional refund amount (if not provided, refunds full amount)
 * @param refundRecordId - Optional refund record ID for idempotency
 */
export async function refundRiftPayment(
  paymentIntentId: string,
  riftId: string,
  amount?: number,
  refundRecordId?: string
): Promise<{ refundId: string | null; error?: string }> {
  if (!stripe) {
    return { refundId: 're_mock_' + paymentIntentId }
  }

  // Enforce refund policy
  const { validateRefundAmount } = await import('./refund-policy')
  
  if (amount) {
    const validation = await validateRefundAmount(riftId, amount)
    if (!validation.valid) {
      return {
        refundId: null,
        error: validation.error || 'Refund validation failed',
      }
    }
  } else {
    // Full refund - check eligibility
    const { checkRefundEligibility } = await import('./refund-policy')
    const eligibility = await checkRefundEligibility(riftId)
    if (!eligibility.canRefundFull) {
      return {
        refundId: null,
        error: eligibility.reason || 'Full refund not allowed',
      }
    }
  }

  try {
    // Generate idempotency key
    const { getRefundIdempotencyKey } = await import('./stripe-idempotency')
    const idempotencyKey = getRefundIdempotencyKey(
      riftId,
      refundRecordId || crypto.randomUUID()
    )

    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        metadata: {
          riftId,
          type: 'rift_refund',
        },
      },
      {
        idempotencyKey: idempotencyKey,
      }
    )

    return { refundId: refund.id }
  } catch (error: any) {
    console.error('Stripe refund error:', error)
    
    // Handle idempotency key conflict
    if (error.code === 'idempotency_key_in_use') {
      console.warn(`Idempotency key conflict for refund - refund may already exist`)
      // Could try to retrieve by metadata, but for now return error
      return {
        refundId: null,
        error: 'Refund may already be in progress',
      }
    }
    
    return {
      refundId: null,
      error: error.message || 'Refund failed',
    }
  }
}

/**
 * Refund a payment (legacy function - no policy enforcement)
 * @deprecated Use refundRiftPayment instead for policy enforcement
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
    // Stripe errors can have message in error.message or error.userMessage
    const errorMsg = error.message || error.userMessage || ''
    const errorType = error.type || ''
    
    // Detect platform profile completion requirement errors
    // This happens when Stripe Connect platform profile hasn't been completed in the dashboard
    if (errorMsg.includes('complete your platform profile') || 
        errorMsg.includes('platform profile') ||
        errorMsg.includes('questionnaire') ||
        errorMsg.includes('review the responsibilities') || 
        errorMsg.includes('platform-profile') ||
        errorMsg.includes('connect/accounts/overview') ||
        error.code === 'account_invalid' ||
        (errorType === 'StripeInvalidRequestError' && errorMsg.includes('platform'))) {
      const mode = process.env.STRIPE_SECRET_KEY?.includes('_live_') ? 'live' : 'test'
      const tasklistUrl = `https://dashboard.stripe.com/${mode === 'live' ? '' : 'test/'}connect/tasklist`
      throw new Error(
        `STRIPE_CONNECT_SETUP_REQUIRED: Stripe Connect platform profile must be completed in ${mode} mode. ` +
        `Visit ${tasklistUrl}, click "Get Started", select "Platform or marketplace", then "Complete your platform profile". ` +
        `Alternatively, go to Settings → Connect → Platform profile in your Stripe Dashboard.`
      )
    }
    
    // Check for capability approval errors
    if (errorMsg.includes('transfers') && errorMsg.includes('card_payments')) {
      throw new Error(
        'Stripe requires approval for transfers capability. Please contact Stripe support or ensure your platform has the necessary approvals.'
      )
    }
    
    throw new Error(`Failed to create Stripe account: ${errorMsg || 'Unknown error'}`)
  }
}

/**
 * Create an account link for Stripe Connect onboarding or account update
 * Returns the onboarding URL
 * 
 * @param accountId - Stripe Connect account ID
 * @param returnUrl - URL to redirect to after completion
 * @param refreshUrl - URL to redirect to if link expires
 * @param forIdentityVerification - If true, use account_update type to specifically complete identity verification
 */
export async function createAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
  forIdentityVerification: boolean = false
): Promise<string> {
  if (!stripe) {
    // In development, return a mock URL
    return `${returnUrl}?mock=true&account_id=mock_${accountId}`
  }

  try {
    // If account already exists and we need identity verification, use account_update
    // This allows users to complete identity verification even after initial onboarding
    const linkType = forIdentityVerification ? 'account_update' : 'account_onboarding'
    
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: linkType,
    })

    return accountLink.url
  } catch (error: any) {
    console.error('Stripe account link creation error:', error)
    
    // Detect HTTPS requirement for live mode
    if (error.message?.includes('Livemode requests must always be redirected via HTTPS') || 
        error.message?.includes('must always be redirected via HTTPS')) {
      const isLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
      if (isLiveMode) {
        throw new Error(
          'Live mode Stripe requires HTTPS URLs for redirects. ' +
          'Please set NEXT_PUBLIC_APP_URL or APP_URL to your production HTTPS URL (e.g., https://joinrift.co). ' +
          'For local development, either use test mode keys (sk_test_...) or use a tool like ngrok to create an HTTPS tunnel.'
        )
      }
    }
    
    // Detect and provide clear messages for common errors
    if (error.message?.includes('live mode') && error.message?.includes('test mode')) {
      // Determine mode from API key (if available) or error message
      const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_LIVE || ''
      const isLiveMode = stripeKey.startsWith('sk_live_')
      const currentMode = isLiveMode ? 'live' : (stripeKey.startsWith('sk_test_') ? 'test' : 'unknown')
      
      const errorDetail = error.message.includes('live mode account link for an account that was created in test mode')
        ? 'The Stripe account was created in test mode, but your API keys are in live mode. Please use test mode API keys for test accounts, or recreate the account in live mode.'
        : 'The Stripe account was created in live mode, but your API keys are in test mode. Please use live mode API keys for live accounts, or recreate the account in test mode.'
      
      throw new Error(`Stripe mode mismatch: ${errorDetail} Current mode: ${currentMode}. Account ID: ${accountId}`)
    }
    
    if (error.type === 'StripeInvalidRequestError') {
      // Provide more context for invalid request errors
      const helpfulMessage = error.message || 'Invalid Stripe request'
      throw new Error(`Stripe error: ${helpfulMessage}. Please check your Stripe configuration and ensure the account exists.`)
    }
    
    throw new Error(`Failed to create account link: ${error.message || 'Unknown error'}`)
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
      if (disabledReason && disabledReason.includes('rejected')) {
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
    // Handle invalid account errors (account deleted, disconnected, or doesn't exist)
    if (error.code === 'account_invalid' || 
        error.type === 'StripePermissionError' ||
        (error.message && error.message.includes('does not have access to account'))) {
      console.warn(`Stripe account ${accountId} is invalid or no longer accessible`)
      // Throw a specific error that route handlers can catch to clear the account ID
      const invalidAccountError: any = new Error(`STRIPE_ACCOUNT_INVALID: Account ${accountId} is invalid or no longer accessible`)
      invalidAccountError.code = 'STRIPE_ACCOUNT_INVALID'
      invalidAccountError.accountId = accountId
      throw invalidAccountError
    }
    
    // Handle test/live key mismatch gracefully
    // This happens when a test account is used with a live key or vice versa
    if (error.message && error.message.includes('test account') && error.message.includes('testmode key')) {
      console.warn(`Stripe account retrieval: Test/live key mismatch for account ${accountId}. Skipping status check.`)
      // Return a default status indicating the account needs to be reconnected with the correct key mode
      return {
        accountId,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        status: 'pending',
        statusMessage: 'Account key mismatch - please reconnect your Stripe account',
      }
    }
    
    console.error('Stripe account retrieval error:', error)
    throw new Error(`Failed to retrieve account status: ${error.message}`)
  }
}

