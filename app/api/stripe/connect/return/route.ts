import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { getConnectAccountStatus } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

/**
 * Handle Stripe Connect onboarding return
 * Redirects user back to dashboard after completing onboarding
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      // If not authenticated, redirect to login with return path
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${APP_URL}/login?redirect=/connect/stripe/return${request.nextUrl.search}`)
    }

    const accountId = request.nextUrl.searchParams.get('account')
    if (!accountId) {
      // No account param, just redirect to dashboard
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${APP_URL}/dashboard?stripe=connected`)
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

    // Check account status to see if onboarding completed
    try {
      const accountStatus = await getConnectAccountStatus(accountId)
      
      // Update user's identity verification status if needed
      if (accountStatus.chargesEnabled && accountStatus.payoutsEnabled) {
        await prisma.user.update({
          where: { id: auth.userId },
          data: {
            stripeIdentityVerified: true,
          },
        })
      }

      // Redirect to dashboard with success status
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
      const redirectUrl = accountStatus.payoutsEnabled
        ? `${APP_URL}/dashboard?stripe=connected`
        : `${APP_URL}/dashboard?stripe=pending`

      return NextResponse.redirect(redirectUrl)
    } catch (statusError) {
      // If we can't check status, still redirect to dashboard
      // The status endpoint will handle checking later
      console.warn('Could not check account status on return:', statusError)
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${APP_URL}/dashboard?stripe=connected`)
    }
  } catch (error) {
    console.error('Stripe Connect return handler error:', error)
    // On error, redirect to dashboard anyway
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${APP_URL}/dashboard?stripe=error`)
  }
}

