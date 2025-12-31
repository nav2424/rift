import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateVerificationCode } from '@/lib/verification-codes'
import { sendVerificationCodeSMS, formatPhoneNumber, validatePhoneNumber } from '@/lib/sms'

/**
 * Update phone number and send verification code during signup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, phone } = body

    if (!userId || !phone) {
      return NextResponse.json(
        { error: 'User ID and phone number are required' },
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

    // Check if phone number is already in use
    const existingUserByPhone = await prisma.user.findFirst({
      where: {
        phone: formattedPhone,
        NOT: { id: userId },
      },
    })

    if (existingUserByPhone) {
      return NextResponse.json(
        { error: 'This phone number is already associated with another account' },
        { status: 400 }
      )
    }

    // Update user's phone number
    await prisma.user.update({
      where: { id: userId },
      data: { phone: formattedPhone },
    })

    // Generate and send phone verification code
    const phoneCode = await generateVerificationCode(userId, 'PHONE', formattedPhone)
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

