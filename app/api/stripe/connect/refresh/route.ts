import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createAccountLink, getConnectAccountStatus } from '@/lib/stripe'

/**
 * Handle Stripe Connect onboarding refresh
 * Creates a new account link if the previous one expired
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      // If not authenticated, redirect to login
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${APP_URL}/login?redirect=/connect/stripe/refresh${request.nextUrl.search}`)
    }

    const accountId = request.nextUrl.searchParams.get('account')
    if (!accountId) {
      // No account param, redirect to dashboard
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${APP_URL}/dashboard?stripe=error`)
    }

    // Verify the account belongs to the authenticated user
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { stripeConnectAccountId: true },
    })

    if (!user || user.stripeConnectAccountId !== accountId) {
      // Account doesn't match user, redirect to dashboard
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${APP_URL}/dashboard?stripe=error`)
    }

    // Check if account needs identity verification or onboarding
    let forIdentityVerification = false
    try {
      const accountStatus = await getConnectAccountStatus(accountId)
      if (accountStatus.detailsSubmitted && !accountStatus.payoutsEnabled && 
          accountStatus.requirements?.currentlyDue && accountStatus.requirements.currentlyDue.length > 0) {
        forIdentityVerification = true
      }
    } catch (statusError) {
      // If we can't check status, proceed with onboarding
      console.warn('Could not check account status on refresh:', statusError)
    }

    // Create new account link
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
    if (!APP_URL) {
      throw new Error('Missing NEXT_PUBLIC_APP_URL or APP_URL environment variable')
    }

    const returnUrl = `${APP_URL}/connect/stripe/return?account=${accountId}`
    const refreshUrl = `${APP_URL}/connect/stripe/refresh?account=${accountId}`

    const onboardingUrl = await createAccountLink(accountId, returnUrl, refreshUrl, forIdentityVerification)

    // Redirect to the new onboarding URL
    return NextResponse.redirect(onboardingUrl)
  } catch (error) {
    console.error('Stripe Connect refresh handler error:', error)
    // On error, redirect to dashboard
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${APP_URL}/dashboard?stripe=error`)
  }
}

