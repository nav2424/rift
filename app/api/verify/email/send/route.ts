import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { generateVerificationCode } from '@/lib/verification-codes'

/**
 * Send email verification code
 * Generates a 6-digit code and sends it to the user's email
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        email: true,
        emailVerified: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Generate and store verification code
    const code = await generateVerificationCode(auth.userId, 'EMAIL', user.email)

    // Send verification email
    const emailHtml = `
      <h2>Verify Your Email</h2>
      <p>Your verification code is: <strong>${code}</strong></p>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `

    const emailSent = await sendEmail(
      user.email,
      'Verify Your Email - Rift',
      emailHtml
    )

    // In development, always return success and show code (even if email failed)
    if (process.env.NODE_ENV === 'development') {
      if (!emailSent) {
        console.warn('⚠️ Email not sent (SMTP not configured). Code:', code)
      }
      return NextResponse.json({
        success: true,
        message: emailSent 
          ? 'Verification code sent to your email' 
          : 'Verification code generated (SMTP not configured - check console)',
        code: code, // Always return code in development for testing
      })
    }

    // In production, return error if email failed
    // But also check if SMTP is configured - if not, provide helpful error
    if (!emailSent) {
      const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD)
      
      if (!smtpConfigured) {
        // SMTP not configured - return code in response for now (one-time exception)
        // In production, admin should configure SMTP
        console.warn('⚠️ SMTP not configured. Returning code in response for this request.')
        return NextResponse.json({
          success: true,
          message: 'Verification code generated. SMTP not configured - code returned in response.',
          code: code, // Return code as exception since SMTP not configured
          smtpNotConfigured: true,
        })
      }
      
      // SMTP is configured but email failed to send
      return NextResponse.json(
        {
          error: 'Failed to send verification email. Please check your email configuration or try again later.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    })
  } catch (error: any) {
    console.error('Send email verification error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
