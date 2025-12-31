import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { getConnectAccountStatus } from '@/lib/stripe'
import { sanitizeErrorMessage, logError } from '@/lib/error-handling'

/**
 * Get Stripe Connect account status
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { stripeConnectAccountId: true, stripeIdentityVerified: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.stripeConnectAccountId) {
      return NextResponse.json({
        connected: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        identityVerified: user.stripeIdentityVerified,
      })
    }

    // Get account status from Stripe
    const accountStatus = await getConnectAccountStatus(user.stripeConnectAccountId)

    // Check if identity verification status has changed based on Stripe account status
    // This handles cases where webhooks haven't fired yet (e.g., in development)
    const isVerified = accountStatus.chargesEnabled && accountStatus.payoutsEnabled
    
    // Update database if verification status has changed
    if (user.stripeIdentityVerified !== isVerified) {
      await prisma.user.update({
        where: { id: auth.userId },
        data: {
          stripeIdentityVerified: isVerified,
        },
      })
      // Only log in development to avoid cluttering production logs
      if (process.env.NODE_ENV === 'development') {
        console.log(`Updated identity verification status: ${user.stripeIdentityVerified} -> ${isVerified}`)
      }
    }

    return NextResponse.json({
      connected: true,
      accountId: accountStatus.accountId,
      chargesEnabled: accountStatus.chargesEnabled,
      payoutsEnabled: accountStatus.payoutsEnabled,
      detailsSubmitted: accountStatus.detailsSubmitted,
      identityVerified: isVerified, // Use the updated status from Stripe
      email: accountStatus.email,
      status: accountStatus.status,
      statusMessage: accountStatus.statusMessage,
      requirements: accountStatus.requirements,
      disabledReason: accountStatus.disabledReason,
    })
  } catch (error: any) {
    logError('Get Stripe Connect status', error)
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, 'Failed to get account status') },
      { status: 500 }
    )
  }
}
