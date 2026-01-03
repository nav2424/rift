import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateVerificationCode } from '@/lib/verification-codes'
import { sendVerificationCodeSMS, formatPhoneNumber, validatePhoneNumber } from '@/lib/sms'
import { getSignupSession } from '@/lib/signup-session'

/**
 * Update phone number and send verification code during signup
 * Works with SignupSession (not User) - user account not created yet
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, phone } = body

    if (!sessionId || !phone) {
      return NextResponse.json(
        { error: 'Session ID and phone number are required' },
        { status: 400 }
      )
    }

    // Validate and format phone number
    const validation = validatePhoneNumber(phone)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid phone number format' },
        { status: 400 }
      )
    }

    const { formatted: formattedPhone, error: formatError } = formatPhoneNumber(phone)
    if (formatError || !formattedPhone) {
      return NextResponse.json(
        { error: formatError || 'Failed to format phone number' },
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

    // Check if phone number is already in use (in User table)
    const existingUserByPhone = await prisma.user.findUnique({
      where: { phone: formattedPhone },
      select: { id: true },
    })

    if (existingUserByPhone) {
      return NextResponse.json(
        { error: 'This phone number is already associated with another account' },
        { status: 400 }
      )
    }

    // Update signup session's phone number
    // Note: updatedAt is automatically handled by Prisma @updatedAt decorator
    await prisma.signup_sessions.update({
      where: { id: sessionId },
      data: {
        phone: formattedPhone,
        phoneVerified: false, // Reset verification when phone changes
      },
    })

    // Generate and send phone verification code (using sessionId, not userId)
    const phoneCode = await generateVerificationCode(sessionId, 'PHONE', formattedPhone, true)
    const smsResult = await sendVerificationCodeSMS(formattedPhone, phoneCode)
    const smsSent = smsResult.success

    const isDevelopment = process.env.NODE_ENV === 'development' || 
                          process.env.NODE_ENV !== 'production' ||
                          process.env.VERCEL_ENV !== 'production'

    // Log status
    if (smsSent) {
      console.log('✅ Verification SMS sent successfully to:', formattedPhone)
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
        ? 'Phone number updated. Please check your phone for the verification code.'
        : (isDevelopment
          ? 'Phone number updated. SMS not sent (Twilio not configured). Check console for verification code.'
          : 'Phone number updated. Verification code sent.'),
    })
  } catch (error: any) {
    console.error('Update signup phone error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

