import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { getConnectAccountStatus } from '@/lib/stripe'

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

    return NextResponse.json({
      connected: true,
      accountId: accountStatus.accountId,
      chargesEnabled: accountStatus.chargesEnabled,
      payoutsEnabled: accountStatus.payoutsEnabled,
      detailsSubmitted: accountStatus.detailsSubmitted,
      identityVerified: user.stripeIdentityVerified,
      email: accountStatus.email,
      status: accountStatus.status,
      statusMessage: accountStatus.statusMessage,
      requirements: accountStatus.requirements,
      disabledReason: accountStatus.disabledReason,
    })
  } catch (error: any) {
    console.error('Get Stripe Connect status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get account status' },
      { status: 500 }
    )
  }
}
