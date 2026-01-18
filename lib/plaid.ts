/**
 * Plaid integration for bank transfers
 * Handles Link token creation and bank account verification
 */

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET_KEY) {
  console.warn('Plaid credentials not set. Bank transfers will not be available.')
}

// Initialize Plaid client
let plaidClient: PlaidApi | null = null

if (process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET_KEY) {
  const configuration = new Configuration({
    basePath: process.env.PLAID_ENV === 'production' 
      ? PlaidEnvironments.production 
      : PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET_KEY,
      },
    },
  })
  
  plaidClient = new PlaidApi(configuration)
}

export const plaid = plaidClient

/**
 * Create a Link token for Plaid Link initialization
 * @param userId - User ID for the Link token
 * @param clientUserId - Optional client user ID (defaults to userId)
 */
export async function createLinkToken(
  userId: string,
  clientUserId?: string
): Promise<string | null> {
  if (!plaid) {
    console.warn('Plaid client not initialized')
    return null
  }

  try {
    const request = {
      user: {
        client_user_id: clientUserId || userId,
      },
      client_name: 'Rift',
      products: [Products.Auth, Products.Transactions] as Products[],
      country_codes: [CountryCode.Us] as CountryCode[],
      language: 'en',
      webhook: process.env.PLAID_WEBHOOK_URL || undefined,
    }

    const response = await plaid.linkTokenCreate(request)
    return response.data.link_token
  } catch (error: any) {
    console.error('Plaid Link token creation error:', error)
    throw new Error(`Failed to create Link token: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Exchange public token for access token
 * @param publicToken - Public token from Plaid Link
 * @param userId - User ID to associate with the access token
 */
export async function exchangePublicToken(
  publicToken: string,
  userId: string
): Promise<{ accessToken: string; itemId: string } | null> {
  if (!plaid) {
    console.warn('Plaid client not initialized')
    return null
  }

  try {
    const response = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    })

    const accessToken = response.data.access_token
    const itemId = response.data.item_id

    // Store access token in database (you may want to add this to your User model)
    // For now, we'll return it and let the caller handle storage

    return { accessToken, itemId }
  } catch (error: any) {
    console.error('Plaid public token exchange error:', error)
    throw new Error(`Failed to exchange public token: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Get account information for a given access token
 */
export async function getAccounts(accessToken: string) {
  if (!plaid) {
    throw new Error('Plaid client not initialized')
  }

  try {
    const response = await plaid.accountsGet({
      access_token: accessToken,
    })

    return response.data.accounts
  } catch (error: any) {
    console.error('Plaid get accounts error:', error)
    throw new Error(`Failed to get accounts: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Create a processor token for Stripe
 * This is used to link a Plaid account to Stripe for ACH payments
 * Note: This function is for future use if we need direct Plaid-Stripe integration
 * Currently, we use Stripe's built-in Plaid integration via us_bank_account
 */
export async function createProcessorToken(
  accessToken: string,
  accountId: string,
  processor: 'stripe' | 'dwolla' | 'ocrolus' = 'stripe'
): Promise<string> {
  if (!plaid) {
    throw new Error('Plaid client not initialized')
  }

  try {
    const response = await plaid.processorTokenCreate({
      access_token: accessToken,
      account_id: accountId,
      processor: processor as any, // Plaid SDK expects specific enum values
    })

    return response.data.processor_token
  } catch (error: any) {
    console.error('Plaid processor token creation error:', error)
    throw new Error(`Failed to create processor token: ${error.message || 'Unknown error'}`)
  }
}
