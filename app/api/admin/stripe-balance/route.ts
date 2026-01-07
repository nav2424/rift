/**
 * Stripe Balance Monitoring API
 * 
 * Endpoint for monitoring Stripe balance availability.
 * Can be called by cron jobs or monitoring systems.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { monitorStripeBalance, getBalanceSummary } from '@/lib/stripe-balance-monitor'
import { runBalanceMonitoring } from '@/workers/stripe-balance-monitor'

/**
 * GET /api/admin/stripe-balance
 * Get current balance summary
 */
export async function GET(request: NextRequest) {
  try {
    // For cron jobs, allow without auth (Vercel cron includes auth header)
    // For manual access, require admin
    const auth = await getAuthenticatedUser(request).catch(() => null)
    
    // Check if this is a cron request (Vercel adds Authorization header)
    const isCronRequest = request.headers.get('authorization')?.includes('Bearer')
    
    if (!isCronRequest && (!auth || auth.userRole !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // If cron request, run full monitoring
    if (isCronRequest) {
      const result = await runBalanceMonitoring()
      return NextResponse.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      })
    }

    // Manual request - just return summary
    const summary = await getBalanceSummary()

    return NextResponse.json({
      success: true,
      ...summary,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Balance monitoring error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get balance summary' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/stripe-balance
 * Run balance monitoring with custom thresholds
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const thresholds = body.thresholds || {}

    const result = await monitorStripeBalance(thresholds)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Balance monitoring error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to monitor balance' },
      { status: 500 }
    )
  }
}
