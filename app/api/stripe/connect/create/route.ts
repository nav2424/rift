import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createOrGetConnectAccount, createAccountLink } from '@/lib/stripe'

/**
 * Create Stripe Connect account and return onboarding URL
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user email and name
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true, name: true, stripeConnectAccountId: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If user already has a Connect account, create a new link for it
    let accountId = user.stripeConnectAccountId

    if (!accountId) {
      // Create new Connect account for individual (not business)
      accountId = await createOrGetConnectAccount(auth.userId, user.email, user.name)

      // Save account ID to user
      await prisma.user.update({
        where: { id: auth.userId },
        data: { stripeConnectAccountId: accountId },
      })
    }

    // Create account link for onboarding
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const returnUrl = `${baseUrl}/wallet?stripe_return=true`
    const refreshUrl = `${baseUrl}/wallet?stripe_refresh=true`

    const onboardingUrl = await createAccountLink(accountId, returnUrl, refreshUrl)

    return NextResponse.json({
      success: true,
      onboardingUrl,
      accountId,
    })
  } catch (error: any) {
    console.error('Create Stripe Connect account error:', error)
    
    // Provide user-friendly error messages
    let errorMessage = error.message || 'Failed to create Stripe account'
    let statusCode = 500
    
    // If it's a Stripe Connect setup issue, return 503 (Service Unavailable)
    if (error.message?.includes('Stripe Connect is not fully configured')) {
      statusCode = 503
      errorMessage = 'Stripe Connect setup is incomplete. Please contact support or complete the setup in Stripe Dashboard.'
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}
