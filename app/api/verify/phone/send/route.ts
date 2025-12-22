import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { generateVerificationCode } from '@/lib/verification-codes'
import { sendVerificationCodeSMS } from '@/lib/sms'

/**
 * Send phone verification code via SMS using Twilio
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { phone } = body

    if (!phone || phone.trim().length === 0) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        phone: true,
        phoneVerified: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.phoneVerified && user.phone === phone) {
      return NextResponse.json(
        { error: 'Phone number is already verified' },
        { status: 400 }
      )
    }

    // Update user's phone number if different
    if (user.phone !== phone) {
      await prisma.user.update({
        where: { id: auth.userId },
        data: {
          phone: phone.trim(),
          phoneVerified: false, // Reset verification when phone changes
        },
      })
    }

    // Generate and store verification code
    const code = await generateVerificationCode(auth.userId, 'PHONE', phone.trim())

    // Send SMS via Twilio
    const smsResult = await sendVerificationCodeSMS(phone.trim(), code)

    if (!smsResult.success) {
      // In development, still return success but log the code
      if (process.env.NODE_ENV === 'development') {
        console.log(`📱 SMS verification code for ${phone}: ${code}`)
        console.warn('⚠️ Twilio not configured. SMS not sent:', smsResult.error)
        return NextResponse.json({
          success: true,
          message: 'Verification code generated (Twilio not configured)',
          code: code, // Return code in development for testing
        })
      }

      // In production, return error if SMS fails
      return NextResponse.json(
        {
          error: smsResult.error || 'Failed to send verification code',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your phone',
      // Only return code in development for testing
      code: process.env.NODE_ENV === 'development' ? code : undefined,
    })
  } catch (error: any) {
    console.error('Send phone verification error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
