/**
 * Stripe Balance Management
 * 
 * Checks Stripe balance availability before transfers to prevent failures.
 */

import { stripe } from './stripe'

export interface BalanceAvailability {
  available: number
  pending: number
  currency: string
  sufficient: boolean
}

/**
 * Check if sufficient balance is available for a transfer
 * Returns balance info and whether transfer amount is available
 */
export async function checkBalanceAvailability(
  amount: number,
  currency: string
): Promise<BalanceAvailability> {
  if (!stripe) {
    // In mock mode, always return sufficient
    return {
      available: amount * 2, // Assume sufficient
      pending: 0,
      currency,
      sufficient: true,
    }
  }

  try {
    const balance = await stripe.balance.retrieve()
    
    // Find balance for the requested currency
    const currencyBalance = balance.available.find(
      (b) => b.currency.toLowerCase() === currency.toLowerCase()
    )

    if (!currencyBalance) {
      // No balance for this currency
      return {
        available: 0,
        pending: 0,
        currency,
        sufficient: false,
      }
    }

    const availableCents = currencyBalance.amount
    const amountCents = Math.round(amount * 100)

    return {
      available: availableCents / 100,
      pending: 0, // Could track pending if needed
      currency,
      sufficient: availableCents >= amountCents,
    }
  } catch (error: any) {
    console.error('Error checking Stripe balance:', error)
    // On error, assume insufficient to be safe
    return {
      available: 0,
      pending: 0,
      currency,
      sufficient: false,
    }
  }
}

/**
 * Wait for balance to become available (with timeout)
 * Useful for queued releases
 */
export async function waitForBalanceAvailability(
  amount: number,
  currency: string,
  maxWaitMs: number = 30000, // 30 seconds default
  checkIntervalMs: number = 2000 // Check every 2 seconds
): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const balance = await checkBalanceAvailability(amount, currency)
    
    if (balance.sufficient) {
      return true
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs))
  }

  return false
}




