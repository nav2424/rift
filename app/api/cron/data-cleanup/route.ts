import { NextRequest, NextResponse } from 'next/server'
import { runDataCleanup } from '@/lib/data-cleanup'

/**
 * Scheduled data cleanup endpoint
 * 
 * Runs daily to clean up expired data:
 * - Expired verification codes
 * - Expired signup sessions
 * 
 * This endpoint should be called via cron job (Vercel Cron or external service)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    const results = await runDataCleanup()

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error: any) {
    console.error('Data cleanup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Allow GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request)
}
