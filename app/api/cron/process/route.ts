import { NextRequest, NextResponse } from 'next/server'
import { processAutoReleases } from '@/lib/auto-release'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

/**
 * Combined cron endpoint for auto-release and payout processing
 * This endpoint handles:
 * 1. Auto-releasing funds for eligible rifts
 * 2. Processing scheduled payouts
 * 
 * Runs daily to keep the system in sync
 */
export async function POST(request: NextRequest) {
  try {
    const isTestEnv = process.env.NODE_ENV === 'test'
    // Fail closed outside tests if cron secret is missing.
    const cronSecret = process.env.CRON_SECRET?.trim()
    if (!cronSecret && !isTestEnv) {
      console.error('CRON_SECRET is not set. Refusing to run cron process endpoint.')
      return NextResponse.json(
        { error: 'Cron endpoint is not configured' },
        { status: 503 }
      )
    }

    // Verify cron secret when configured.
    if (cronSecret) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const results = {
      autoRelease: { processed: 0, results: [] as any[] },
      ugcAutoApprove: {
        processed: 0,
        approved: [] as string[],
        skipped: [] as string[],
        error: undefined as string | undefined,
      },
      payouts: { processed: 0, results: [] as any[] },
    }

    // Step 1: Process auto-releases
    try {
      const autoReleaseResults = await processAutoReleases()
      results.autoRelease = {
        processed: autoReleaseResults.length,
        results: autoReleaseResults,
      }
    } catch (error: any) {
      console.error('Auto-release processing error:', error)
      results.autoRelease.results.push({ error: error.message })
    }

    // Step 1b: UGC milestone auto-approve (delivered + past acceptance window, no dispute)
    try {
      const { autoApproveMilestonesJob } = await import('@/lib/ugc/auto-approve')
      const ugcResult = await autoApproveMilestonesJob()
      results.ugcAutoApprove = {
        processed: ugcResult.processed,
        approved: ugcResult.approved,
        skipped: ugcResult.skipped,
        error: undefined,
      }
    } catch (error: any) {
      console.error('UGC auto-approve error:', error)
      results.ugcAutoApprove = { processed: 0, approved: [], skipped: [], error: error.message }
    }

    // Step 2: Process scheduled payouts
    try {
      const now = new Date()
      const payouts = await prisma.payout.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: now },
        },
        include: {
          User: {
            select: {
              stripeConnectAccountId: true,
            },
          },
        },
      })

      for (const payout of payouts) {
        try {
          if (!payout.User.stripeConnectAccountId) {
            await prisma.payout.update({
              where: { id: payout.id },
              data: {
                status: 'FAILED',
                failureReason: 'Stripe Connect account not set up',
              },
            })
            results.payouts.results.push({ payoutId: payout.id, success: false, error: 'No Stripe account' })
            continue
          }

          if (stripe) {
            const transfer = await stripe.transfers.create({
              amount: Math.round(payout.amount * 100),
              currency: payout.currency.toLowerCase(),
              destination: payout.User.stripeConnectAccountId,
              metadata: {
                payoutId: payout.id,
                riftId: payout.riftId || '',
                userId: payout.userId,
              },
            })

            await prisma.payout.update({
              where: { id: payout.id },
              data: {
                status: 'PROCESSING',
                stripeTransferId: transfer.id,
              },
            })

            results.payouts.results.push({ payoutId: payout.id, success: true, transferId: transfer.id })
          } else {
            await prisma.payout.update({
              where: { id: payout.id },
              data: {
                status: 'COMPLETED',
                processedAt: new Date(),
              },
            })
            results.payouts.results.push({ payoutId: payout.id, success: true, mock: true })
          }
        } catch (error: any) {
          console.error(`Error processing payout ${payout.id}:`, error)
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: 'FAILED',
              failureReason: error.message,
            },
          })
          results.payouts.results.push({ payoutId: payout.id, success: false, error: error.message })
        }
      }

      results.payouts.processed = results.payouts.results.length
    } catch (error: any) {
      console.error('Payout processing error:', error)
      results.payouts.results.push({ error: error.message })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    })
  } catch (error: any) {
    console.error('Cron processing error:', error)
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

