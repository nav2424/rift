/**
 * Stripe Balance Monitor Worker
 * 
 * Cron job to monitor Stripe balance and send alerts.
 * Should be scheduled to run every 15-30 minutes.
 * 
 * Usage:
 * - Add to vercel.json cron jobs
 * - Or run via external cron service
 */

import { monitorStripeBalance } from '@/lib/stripe-balance-monitor'
import { sendBalanceAlertEmail } from '@/lib/email'

/**
 * Run balance monitoring
 * Called by cron job
 */
export async function runBalanceMonitoring() {
  try {
    console.log('[Balance Monitor] Starting balance check...')
    
    // Custom thresholds per currency (adjust as needed)
    const thresholds = {
      CAD: 1000, // $1000 CAD minimum
      USD: 1000, // $1000 USD minimum
      EUR: 1000, // €1000 EUR minimum
    }

    const result = await monitorStripeBalance(thresholds)

    // Send alerts if critical or warning
    const criticalAlerts = result.alerts.filter(a => a.alert === 'critical')
    const warningAlerts = result.alerts.filter(a => a.alert === 'warning')

    if (criticalAlerts.length > 0) {
      console.error('[Balance Monitor] CRITICAL alerts:', criticalAlerts)
      
      // Send email alert (if email service configured)
      try {
        await sendBalanceAlertEmail(criticalAlerts, result.balances)
      } catch (emailError) {
        console.error('[Balance Monitor] Failed to send email alert:', emailError)
      }
    }

    if (warningAlerts.length > 0) {
      console.warn('[Balance Monitor] WARNING alerts:', warningAlerts)
    }

    console.log('[Balance Monitor] Completed. Alerts:', result.alerts.length)
    
    return result
  } catch (error: any) {
    console.error('[Balance Monitor] Error:', error)
    throw error
  }
}

// For direct execution (testing)
if (require.main === module) {
  runBalanceMonitoring()
    .then(() => {
      console.log('Balance monitoring completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Balance monitoring failed:', error)
      process.exit(1)
    })
}

