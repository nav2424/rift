import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createOrGetConnectAccount, createAccountLink, getConnectAccountStatus } from '@/lib/stripe'
import { sanitizeErrorMessage, logError } from '@/lib/error-handling'

/**
 * Create Stripe Connect account and return onboarding URL
 * Supports both initial onboarding and identity verification completion
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
    let forIdentityVerification = false

    if (!accountId) {
      // Create new Connect account for individual (not business)
      accountId = await createOrGetConnectAccount(auth.userId, user.email, user.name)

      // Save account ID to user
      await prisma.user.update({
        where: { id: auth.userId },
        data: { stripeConnectAccountId: accountId },
      })
    } else {
      // Check if account exists and needs identity verification
      // If account is already created but identity verification is incomplete,
      // use account_update type instead of account_onboarding
      try {
        const accountStatus = await getConnectAccountStatus(accountId)
        // If account is connected but payouts are not enabled due to verification requirements,
        // use account_update to complete identity verification
        if (accountStatus.detailsSubmitted && !accountStatus.payoutsEnabled && 
            accountStatus.requirements?.currentlyDue && accountStatus.requirements.currentlyDue.length > 0) {
          forIdentityVerification = true
        }
      } catch (statusError) {
        // If we can't check status, proceed with onboarding
        logError('Check account status', statusError, { context: 'Creating account link' })
      }
    }

    // Create account link for onboarding or identity verification
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const returnUrl = `${baseUrl}/wallet?stripe_return=true`
    const refreshUrl = `${baseUrl}/wallet?stripe_refresh=true`

    const onboardingUrl = await createAccountLink(accountId, returnUrl, refreshUrl, forIdentityVerification)

    return NextResponse.json({
      success: true,
      onboardingUrl,
      accountId,
    })
  } catch (error: any) {
    logError('Create Stripe Connect account', error)
    
    let statusCode = 500
    let errorMessage = sanitizeErrorMessage(error, 'Failed to create Stripe account')
    
    // Handle specific error cases
    if (error.message?.includes('Stripe Connect is not fully configured')) {
      statusCode = 503
      errorMessage = 'Stripe Connect setup is incomplete. Please contact support or complete the setup in Stripe Dashboard.'
    } else if (error.message?.includes('account_onboarding') || error.message?.includes('account_update')) {
      errorMessage = 'Unable to start Stripe verification. Please try again or contact support.'
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}
