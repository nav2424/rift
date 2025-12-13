import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { canUserWithdraw, debitSellerOnWithdrawal } from '@/lib/wallet'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

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

    // Check if user can withdraw
    const canWithdraw = await canUserWithdraw(auth.userId)
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

    // Debit wallet (this will throw if insufficient balance)
    await debitSellerOnWithdrawal(auth.userId, amount, currency, {
      requestedAt: new Date().toISOString(),
    })

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
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
        console.error('Stripe transfer error:', error)
        
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
            failureReason: error.message,
          },
        })

        return NextResponse.json(
          { error: `Payout failed: ${error.message}` },
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
    })
  } catch (error: any) {
    console.error('Withdraw error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
