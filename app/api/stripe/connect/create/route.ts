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
      // Check if account exists and what type of link it needs
      // If account is already created but onboarding is incomplete, use account_onboarding
      // If account completed onboarding but needs identity verification, use account_update
      try {
        const accountStatus = await getConnectAccountStatus(accountId)
        console.log('[Stripe Connect] Existing account status:', {
          accountId,
          detailsSubmitted: accountStatus.detailsSubmitted,
          payoutsEnabled: accountStatus.payoutsEnabled,
          chargesEnabled: accountStatus.chargesEnabled,
          status: accountStatus.status,
        })
        
        // If account hasn't completed initial onboarding (details not submitted)
        // Use account_onboarding type
        if (!accountStatus.detailsSubmitted) {
          forIdentityVerification = false // Use account_onboarding
          console.log('[Stripe Connect] Account needs initial onboarding')
        } 
        // If account completed onboarding but payouts are not enabled due to verification requirements,
        // use account_update to complete identity verification
        else if (accountStatus.detailsSubmitted && !accountStatus.payoutsEnabled && 
            accountStatus.requirements?.currentlyDue && accountStatus.requirements.currentlyDue.length > 0) {
          forIdentityVerification = true // Use account_update
          console.log('[Stripe Connect] Account needs identity verification')
        }
        // If account is fully set up, we shouldn't be here, but create an update link anyway
        else if (accountStatus.payoutsEnabled && accountStatus.chargesEnabled) {
          console.log('[Stripe Connect] Account is already fully set up')
          // Still create a link in case user wants to update something
          forIdentityVerification = true
        }
      } catch (statusError: any) {
        // If account is invalid, clear it and create a new one
        if (statusError.code === 'STRIPE_ACCOUNT_INVALID') {
          console.log(`Account ${accountId} is invalid, clearing and creating new account`)
          await prisma.user.update({
            where: { id: auth.userId },
            data: { stripeConnectAccountId: null },
          })
          // Create new account
          accountId = await createOrGetConnectAccount(auth.userId, user.email, user.name)
          await prisma.user.update({
            where: { id: auth.userId },
            data: { stripeConnectAccountId: accountId },
          })
        } else {
          // If we can't check status for other reasons, proceed with onboarding
          console.warn('[Stripe Connect] Could not check account status, proceeding with onboarding:', statusError.message)
          logError('Check account status', statusError, { context: 'Creating account link' })
          // Default to account_onboarding if we can't determine status
          forIdentityVerification = false
        }
      }
    }

    // Create account link for onboarding or identity verification
    // Use NEXT_PUBLIC_APP_URL to ensure redirects go to Rift domain, not Vercel
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
    if (!APP_URL) {
      throw new Error('Missing NEXT_PUBLIC_APP_URL or APP_URL environment variable')
    }

    // Check if we're using live mode Stripe keys
    const isLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
    
    // Ensure HTTPS for live mode (Stripe requires HTTPS for live mode redirects)
    let baseUrl = APP_URL.trim().replace(/\/$/, '') // Remove trailing slash
    
    // If using live mode and URL is HTTP, we need HTTPS
    if (isLiveMode && baseUrl.startsWith('http://')) {
      // Try to use production URL if available
      const productionUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://joinrift.co'
      if (productionUrl.startsWith('https://')) {
        baseUrl = productionUrl.trim().replace(/\/$/, '')
        console.warn('[Stripe Connect] Live mode detected with HTTP URL, using production HTTPS URL:', baseUrl)
      } else {
        // Force HTTPS for localhost in live mode (won't work, but better error message)
        baseUrl = baseUrl.replace('http://', 'https://')
        throw new Error(
          'Live mode Stripe requires HTTPS URLs. ' +
          'Please set NEXT_PUBLIC_APP_URL or APP_URL to your production HTTPS URL (e.g., https://joinrift.co). ' +
          'For local development with live mode, use a tool like ngrok or test with test mode keys instead.'
        )
      }
    }

    const returnUrl = `${baseUrl}/connect/stripe/return?account=${accountId}`
    const refreshUrl = `${baseUrl}/connect/stripe/refresh?account=${accountId}`

    // Log URLs to confirm they use Rift domain (not Vercel)
    console.log('[Stripe Connect] Creating account link with URLs:', {
      returnUrl,
      refreshUrl,
      accountId,
      linkType: forIdentityVerification ? 'account_update' : 'account_onboarding',
    })

    let onboardingUrl: string
    try {
      onboardingUrl = await createAccountLink(accountId, returnUrl, refreshUrl, forIdentityVerification)
    } catch (linkError: any) {
      // If account link creation fails, log the error but don't fail the whole request
      // The account was already created, so we should still try to return a way to complete onboarding
      console.error('[Stripe Connect] Account link creation failed:', linkError)
      
      // If the error is about platform profile, include that in the response
      const linkErrorMsg = linkError.message || ''
      if (linkErrorMsg.includes('platform profile') || linkErrorMsg.includes('STRIPE_CONNECT_SETUP_REQUIRED')) {
        throw linkError // Re-throw platform profile errors so they're handled by the error handler
      }
      
      // For other errors, still return the account ID so the frontend can try to refresh the link
      // The user can manually navigate to complete onboarding
      return NextResponse.json({
        success: false,
        accountId,
        error: `Account created but could not generate onboarding link: ${linkErrorMsg}`,
        // Provide a way to manually get the onboarding URL
        refreshUrl: `${APP_URL}/connect/stripe/refresh?account=${accountId}`,
      }, { status: 200 }) // Return 200 so frontend can handle it
    }

    console.log('[Stripe Connect] Successfully created account link:', {
      accountId,
      onboardingUrl: onboardingUrl.substring(0, 100) + '...', // Log partial URL for security
      linkType: forIdentityVerification ? 'account_update' : 'account_onboarding',
    })

    return NextResponse.json({
      success: true,
      onboardingUrl,
      accountId,
    })
  } catch (error: any) {
    logError('Create Stripe Connect account', error)
    
    let statusCode = 500
    let errorMessage = sanitizeErrorMessage(error, 'Failed to create Stripe account')
    
    // Handle specific error cases with clearer messages
    const errorMsg = error.message || ''
    
    if (errorMsg.includes('STRIPE_CONNECT_SETUP_REQUIRED') || 
        errorMsg.includes('complete your platform profile') ||
        errorMsg.includes('platform profile') ||
        errorMsg.includes('questionnaire')) {
      statusCode = 503 // Service Unavailable - configuration issue, not user error
      // Extract the helpful message from the error
      if (errorMsg.includes('STRIPE_CONNECT_SETUP_REQUIRED')) {
        errorMessage = errorMsg.replace('STRIPE_CONNECT_SETUP_REQUIRED: ', '')
      } else {
        const mode = process.env.STRIPE_SECRET_KEY?.includes('_live_') ? 'live' : 'test'
        const tasklistUrl = `https://dashboard.stripe.com/${mode === 'live' ? '' : 'test/'}connect/tasklist`
        errorMessage = `Stripe Connect platform profile must be completed. Visit ${tasklistUrl}, click "Get Started", select "Platform or marketplace", then "Complete your platform profile". Alternatively, go to Settings → Connect → Platform profile in your Stripe Dashboard.`
      }
    } else if (errorMsg.includes('Stripe mode mismatch')) {
      statusCode = 400
      errorMessage = errorMsg // Use the detailed message from createAccountLink
    } else if (errorMsg.includes('Stripe Connect is not fully configured')) {
      statusCode = 503
      errorMessage = 'Stripe Connect setup is incomplete. Please contact support or complete the setup in Stripe Dashboard.'
    } else if (errorMsg.includes('account_onboarding') || errorMsg.includes('account_update')) {
      statusCode = 400
      errorMessage = 'Unable to start Stripe verification. Please try again or contact support.'
    } else if (errorMsg.includes('test mode') || errorMsg.includes('live mode')) {
      statusCode = 400
      errorMessage = errorMsg || 'Stripe configuration error: Test and live mode mismatch. Please check your Stripe API keys match the account mode.'
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}
