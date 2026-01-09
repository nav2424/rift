import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { canUserWithdraw, debitSellerOnWithdrawal } from '@/lib/wallet'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getConnectAccountStatus } from '@/lib/stripe'
import { sanitizeErrorMessage, logError } from '@/lib/error-handling'

/**
 * Check if user can withdraw (GET/HEAD)
 * Returns withdrawal eligibility status
 * Also refreshes Stripe verification status if account exists
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Refresh Stripe verification status before checking withdrawal eligibility
    // This ensures we have the latest status from Stripe (important after returning from Stripe)
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { stripeConnectAccountId: true, stripeIdentityVerified: true },
    })

    if (user?.stripeConnectAccountId && stripe) {
      try {
        const accountStatus = await getConnectAccountStatus(user.stripeConnectAccountId)
        const isVerified = accountStatus.chargesEnabled && accountStatus.payoutsEnabled
        
        // Update database if verification status has changed
        if (user.stripeIdentityVerified !== isVerified) {
          await prisma.user.update({
            where: { id: auth.userId },
            data: {
              stripeIdentityVerified: isVerified,
            },
          })
          // Only log in development
          if (process.env.NODE_ENV === 'development') {
            console.log(`Updated identity verification status in withdraw check: ${user.stripeIdentityVerified} -> ${isVerified}`)
          }
        }
      } catch (error: any) {
        // If we can't check Stripe status, continue with database value
        logError('Refresh Stripe status in withdraw check', error, { context: 'Withdrawal eligibility check' })
      }
    }

    const canWithdraw = await canUserWithdraw(auth.userId, auth.isMobile)
    return NextResponse.json({
      canWithdraw: canWithdraw.canWithdraw,
      reason: canWithdraw.reason,
    })
  } catch (error: any) {
    logError('Check withdrawal eligibility', error)
    
    // Use database error handler for connection errors
    const { getDatabaseErrorDetails } = await import('@/lib/db-error-handler')
    const dbError = getDatabaseErrorDetails(error)
    
    // If it's a database connection error, return detailed message
    if (dbError.statusCode === 503 || dbError.statusCode === 401) {
      return NextResponse.json(
        { 
          error: dbError.message,
          actionable: dbError.actionable,
          code: error?.code || 'DATABASE_ERROR',
        },
        { status: dbError.statusCode }
      )
    }
    
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, 'Failed to check withdrawal eligibility') },
      { status: 500 }
    )
  }
}

/**
 * Request withdrawal (seller action)
 * Creates payout record and processes via Stripe Connect
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, currency = 'CAD' } = body

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      )
    }

    // Check if user can withdraw (pass isMobile flag - email verification only required for mobile)
    const canWithdraw = await canUserWithdraw(auth.userId, auth.isMobile)
    if (!canWithdraw.canWithdraw) {
      return NextResponse.json(
        { error: canWithdraw.reason || 'Cannot withdraw' },
        { status: 400 }
      )
    }

    // Get user's Stripe Connect account
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { stripeConnectAccountId: true },
    })

    if (!user?.stripeConnectAccountId) {
      return NextResponse.json(
        { error: 'Stripe Connect account not set up' },
        { status: 400 }
      )
    }

    // Check if this is a first withdrawal (no completed payouts)
    const completedPayoutsCount = await prisma.payout.count({
      where: {
        userId: auth.userId,
        status: 'COMPLETED',
      },
    })
    const isFirstWithdrawal = completedPayoutsCount === 0

    // Debit wallet (this will throw if insufficient balance)
    await debitSellerOnWithdrawal(auth.userId, amount, currency, {
      requestedAt: new Date().toISOString(),
    })

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        id: crypto.randomUUID(),
        updatedAt: new Date(),
        userId: auth.userId,
        amount,
        currency,
        status: 'PENDING',
      },
    })

    // Process payout via Stripe
    let stripePayoutId: string | null = null
    let stripeTransferId: string | null = null

    if (stripe) {
      try {
        // Transfer to connected account
        const transfer = await stripe.transfers.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          destination: user.stripeConnectAccountId,
          metadata: {
            payoutId: payout.id,
            userId: auth.userId,
            type: 'withdrawal',
          },
        })

        stripeTransferId = transfer.id

        // Update payout record
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            stripeTransferId: transfer.id,
            status: 'PROCESSING',
          },
        })
      } catch (error: any) {
        logError('Stripe transfer', error, { payoutId: payout.id, userId: auth.userId, amount })
        
        // Rollback wallet debit on failure
        await prisma.walletAccount.update({
          where: { userId: auth.userId },
          data: {
            availableBalance: { increment: amount },
          },
        })

        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 'FAILED',
            failureReason: sanitizeErrorMessage(error, 'Transfer failed'),
          },
        })

        return NextResponse.json(
          { error: sanitizeErrorMessage(error, 'Payout failed. Please try again or contact support.') },
          { status: 500 }
        )
      }
    } else {
      // Mock mode - mark as completed
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      payoutId: payout.id,
      stripeTransferId,
      amount,
      currency,
      isFirstWithdrawal,
    })
  } catch (error: any) {
    logError('Withdraw', error)
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, 'Withdrawal failed. Please try again or contact support.') },
      { status: 500 }
    )
  }
}
