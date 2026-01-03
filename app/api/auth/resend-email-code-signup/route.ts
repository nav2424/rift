import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/signup-session'
import { generateVerificationCode } from '@/lib/verification-codes'
import { sendEmail } from '@/lib/email'

/**
 * Resend email verification code during signup (before account creation)
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

    // Don't resend if already verified
    if (session.emailVerified) {
      return NextResponse.json(
        { error: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Generate and send email verification code (linked to session, not user)
    const emailCode = await generateVerificationCode(sessionId, 'EMAIL', session.email, true)
    const emailHtml = `
      <h2>Verify Your Email</h2>
      <p>Your verification code is: <strong>${emailCode}</strong></p>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `
    const emailSent = await sendEmail(session.email, 'Verify Your Email - Rift', emailHtml)

    const isDevelopment = process.env.NODE_ENV === 'development' || 
                          process.env.NODE_ENV !== 'production' ||
                          process.env.VERCEL_ENV !== 'production'

    // Log status
    if (emailSent) {
      console.log('✅ Verification email sent successfully to:', session.email)
    } else {
      console.warn('⚠️ Email not sent. SMTP may not be configured. Check SMTP_USER and SMTP_PASSWORD in .env.local')
      if (isDevelopment) {
        console.warn('   Dev code:', emailCode)
      }
    }

    return NextResponse.json({
      success: true,
      // Only return code in development if email failed to send (for testing purposes only)
      emailCode: !emailSent && isDevelopment ? emailCode : undefined,
      emailSent,
      message: emailSent 
        ? 'Verification code sent to your email'
        : (isDevelopment 
          ? 'Verification code generated (SMTP not configured). Check console for code.'
          : 'Verification code sent.'),
    })
  } catch (error: any) {
    console.error('Resend email code signup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

