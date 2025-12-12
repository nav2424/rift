import { NextRequest, NextResponse } from 'next/server'
import { processAutoReleases } from '@/lib/auto-release'

/**
 * API endpoint to trigger auto-release processing
 * This should be called periodically (via cron job, scheduled task, or webhook)
 * 
 * For production, set up a cron job or use a service like Vercel Cron:
 * - Vercel: Add to vercel.json
 * - Other: Set up cron job to call this endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if configured (recommended for production)
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      // Log warning if no secret is set (security risk in production)
      if (process.env.NODE_ENV === 'production') {
        console.warn('WARNING: CRON_SECRET not set. Auto-release endpoint is unprotected!')
      }
    }

    const results = await processAutoReleases()

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error('Auto-release processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Also allow GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request)
}

