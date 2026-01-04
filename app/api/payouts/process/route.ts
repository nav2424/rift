import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

/**
 * Process scheduled payouts
 * Should be called periodically (cron job)
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
    }

    const now = new Date()

    // Find payouts that are scheduled and ready to process
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

    const results = []

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
          results.push({ payoutId: payout.id, success: false, error: 'No Stripe account' })
          continue
        }

        if (stripe) {
          // Process via Stripe
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

          results.push({ payoutId: payout.id, success: true, transferId: transfer.id })
        } else {
          // Mock mode
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: 'COMPLETED',
              processedAt: new Date(),
            },
          })
          results.push({ payoutId: payout.id, success: true, mock: true })
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
        results.push({ payoutId: payout.id, success: false, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error: any) {
    console.error('Process payouts error:', error)
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
