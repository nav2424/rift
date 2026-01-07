/**
 * Stripe Balance Monitoring
 * 
 * Monitors Stripe balance availability and alerts when balance is low.
 * Should be called periodically (e.g., via cron job) to ensure sufficient funds.
 */

import { stripe } from './stripe'
import { checkBalanceAvailability } from './stripe-balance'

export interface BalanceAlert {
  currency: string
  available: number
  threshold: number
  percentage: number
  alert: 'critical' | 'warning' | 'info'
}

export interface BalanceMonitorResult {
  timestamp: Date
  alerts: BalanceAlert[]
  balances: Array<{
    currency: string
    available: number
    pending: number
  }>
}

/**
 * Monitor Stripe balance and generate alerts
 * 
 * @param thresholds - Currency-specific thresholds (default: 1000 for all)
 * @returns Balance monitoring result with alerts
 */
export async function monitorStripeBalance(
  thresholds: Record<string, number> = {}
): Promise<BalanceMonitorResult> {
  const defaultThreshold = 1000 // $1000 default threshold
  const result: BalanceMonitorResult = {
    timestamp: new Date(),
    alerts: [],
    balances: [],
  }

  if (!stripe) {
    console.warn('Stripe not configured - balance monitoring skipped')
    return result
  }

  try {
    const balance = await stripe.balance.retrieve()

    // Process each currency
    for (const availableBalance of balance.available) {
      const currency = availableBalance.currency.toUpperCase()
      const available = availableBalance.amount / 100 // Convert from cents
      const threshold = thresholds[currency] || defaultThreshold
      const percentage = (available / threshold) * 100

      result.balances.push({
        currency,
        available,
        pending: 0, // Could track pending if needed
      })

      // Generate alerts based on thresholds
      if (available < threshold * 0.1) {
        // Critical: Less than 10% of threshold
        result.alerts.push({
          currency,
          available,
          threshold,
          percentage,
          alert: 'critical',
        })
      } else if (available < threshold * 0.3) {
        // Warning: Less than 30% of threshold
        result.alerts.push({
          currency,
          available,
          threshold,
          percentage,
          alert: 'warning',
        })
      } else if (available < threshold) {
        // Info: Below threshold but not critical
        result.alerts.push({
          currency,
          available,
          threshold,
          percentage,
          alert: 'info',
        })
      }
    }

    // Log alerts
    if (result.alerts.length > 0) {
      console.warn('[Stripe Balance Monitor] Alerts detected:', result.alerts)
      
      // In production, you might want to:
      // - Send email alerts
      // - Post to Slack/Discord
      // - Create incident tickets
      // - Trigger automated actions
    } else {
      console.log('[Stripe Balance Monitor] All balances healthy')
    }

    return result
  } catch (error: any) {
    console.error('[Stripe Balance Monitor] Error:', error)
    throw new Error(`Balance monitoring failed: ${error.message}`)
  }
}

/**
 * Check if balance is sufficient for a specific amount
 * Returns detailed result for monitoring/logging
 */
export async function checkBalanceForTransfer(
  amount: number,
  currency: string
): Promise<{
  sufficient: boolean
  available: number
  required: number
  shortfall: number
  alert?: BalanceAlert
}> {
  const balance = await checkBalanceAvailability(amount, currency)

  const result = {
    sufficient: balance.sufficient,
    available: balance.available,
    required: amount,
    shortfall: balance.sufficient ? 0 : amount - balance.available,
  }

  if (!balance.sufficient) {
    // Generate alert
    const threshold = amount * 2 // Alert if less than 2x required
    const percentage = (balance.available / threshold) * 100

    result.alert = {
      currency,
      available: balance.available,
      threshold,
      percentage,
      alert: balance.available < amount * 0.5 ? 'critical' : 'warning',
    }
  }

  return result
}

/**
 * Get balance summary for dashboard/monitoring
 */
export async function getBalanceSummary(): Promise<{
  currencies: Array<{
    currency: string
    available: number
    pending: number
    status: 'healthy' | 'low' | 'critical'
  }>
  totalAvailable: number
  lowestBalance: { currency: string; amount: number } | null
}> {
  if (!stripe) {
    return {
      currencies: [],
      totalAvailable: 0,
      lowestBalance: null,
    }
  }

  try {
    const balance = await stripe.balance.retrieve()
    const currencies = balance.available.map((b) => {
      const available = b.amount / 100
      let status: 'healthy' | 'low' | 'critical' = 'healthy'

      if (available < 100) {
        status = 'critical'
      } else if (available < 500) {
        status = 'low'
      }

      return {
        currency: b.currency.toUpperCase(),
        available,
        pending: 0, // Could track pending
        status,
      }
    })

    const totalAvailable = currencies.reduce((sum, c) => sum + c.available, 0)
    const lowestBalance = currencies.length > 0
      ? currencies.reduce((lowest, c) => 
          c.available < (lowest?.amount || Infinity) 
            ? { currency: c.currency, amount: c.available }
            : lowest
        , null as { currency: string; amount: number } | null)
      : null

    return {
      currencies,
      totalAvailable,
      lowestBalance,
    }
  } catch (error: any) {
    console.error('Error getting balance summary:', error)
    return {
      currencies: [],
      totalAvailable: 0,
      lowestBalance: null,
    }
  }
}

