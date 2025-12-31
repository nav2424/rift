import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'
import { randomUUID } from 'crypto'

const RESET_TOKEN_EXPIRY_HOURS = 1

/**
 * POST /api/auth/forgot-password
 * Request password reset - sends email with reset link
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
      },
    })

    // Don't reveal if user exists or not (security best practice)
    // Always return success message even if user doesn't exist
    if (!user) {
      // Return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

    // Delete any existing password reset codes for this user
    await prisma.verificationCode.deleteMany({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
      },
    })

    // Store reset token
    await prisma.verificationCode.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        type: 'PASSWORD_RESET',
        code: resetToken,
        contactInfo: user.email,
        expiresAt,
        attempts: 0,
      },
    })

    // Create reset URL
    const baseUrl = process.env.NEXTAUTH_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                   'http://localhost:3000'
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`

    // Send password reset email
    const emailHtml = `
      <h2>Reset Your Password</h2>
      <p>You requested to reset your password for your Rift account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">Reset Password</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p>This link will expire in ${RESET_TOKEN_EXPIRY_HOURS} hour${RESET_TOKEN_EXPIRY_HOURS !== 1 ? 's' : ''}.</p>
      <p>If you didn't request a password reset, please ignore this email.</p>
    `

    const emailSent = await sendEmail(
      user.email,
      'Reset Your Password - Rift',
      emailHtml
    )

    // In development, log the reset token if email failed
    if (process.env.NODE_ENV === 'development' && !emailSent) {
      console.warn('⚠️ Email not sent (SMTP not configured). Reset token:', resetToken)
      console.warn('⚠️ Reset URL:', resetUrl)
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Only return token in development for testing
      ...(process.env.NODE_ENV === 'development' && !emailSent && {
        resetToken,
        resetUrl,
        note: 'Token returned in development mode only (SMTP not configured)',
      }),
    })
  } catch (error: any) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

