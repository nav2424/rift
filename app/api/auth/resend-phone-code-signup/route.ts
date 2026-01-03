import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/signup-session'
import { generateVerificationCode } from '@/lib/verification-codes'
import { sendVerificationCodeSMS } from '@/lib/sms'

/**
 * Resend phone verification code during signup (before account creation)
 * Works with SignupSession (not User) - user account not created yet
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Get signup session
    const session = await getSignupSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Signup session not found or expired' },
        { status: 404 }
      )
    }

    if (!session.phone) {
      return NextResponse.json(
        { error: 'Phone number not set in signup session' },
        { status: 400 }
      )
    }

    // Don't resend if already verified
    if (session.phoneVerified) {
      return NextResponse.json(
        { error: 'Phone number is already verified' },
        { status: 400 }
      )
    }

    // Generate and send phone verification code (using sessionId, not userId)
    const phoneCode = await generateVerificationCode(sessionId, 'PHONE', session.phone, true)
    const smsResult = await sendVerificationCodeSMS(session.phone, phoneCode)
    const smsSent = smsResult.success

    const isDevelopment = process.env.NODE_ENV === 'development' || 
                          process.env.NODE_ENV !== 'production' ||
                          process.env.VERCEL_ENV !== 'production'

    // Log status
    if (smsSent) {
      console.log('✅ Verification SMS sent successfully to:', session.phone)
    } else {
      console.warn('⚠️ SMS not sent. Twilio may not be configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env.local')
      if (smsResult.error) {
        console.warn('   Error:', smsResult.error)
      }
      if (isDevelopment) {
        console.warn('   Dev code:', phoneCode)
      }
    }

    return NextResponse.json({
      success: true,
      // Only return code in development if SMS failed to send (for testing purposes only)
      phoneCode: !smsSent && isDevelopment ? phoneCode : undefined,
      smsSent,
      message: smsSent 
        ? 'Verification code sent to your phone'
        : (isDevelopment
          ? 'Verification code generated (Twilio not configured). Check console for code.'
          : 'Verification code sent.'),
    })
  } catch (error: any) {
    console.error('Resend phone code signup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

