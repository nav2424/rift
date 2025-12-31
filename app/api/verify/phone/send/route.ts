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

    // Validate and format phone number to E.164 format
    const { formatPhoneNumber, validatePhoneNumber } = await import('@/lib/sms')
    
    // First validate
    const validation = validatePhoneNumber(phone)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid phone number format. Please include country code (e.g., +1 for US/Canada)' },
        { status: 400 }
      )
    }
    
    // Then format to E.164
    const { formatted: formattedPhone, error: formatError } = formatPhoneNumber(phone)
    if (formatError || !formattedPhone) {
      return NextResponse.json(
        { error: formatError || 'Failed to format phone number' },
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

    // Compare with formatted phone (user.phone should already be in E.164 format)
    if (user.phoneVerified && user.phone === formattedPhone) {
      return NextResponse.json(
        { error: 'Phone number is already verified' },
        { status: 400 }
      )
    }

          // Update user's phone number if different (store in E.164 format)
          if (user.phone !== formattedPhone) {
            // Check if phone number is already in use by another user (only for completed signups)
            const existingUserByPhone = await prisma.user.findFirst({
              where: {
                phone: formattedPhone,
                onboardingCompleted: true,
                id: { not: auth.userId }, // Exclude current user
              },
            })

            if (existingUserByPhone) {
              return NextResponse.json(
                { error: 'This phone number is already associated with another account' },
                { status: 400 }
              )
            }

            await prisma.user.update({
              where: { id: auth.userId },
              data: {
                phone: formattedPhone,
                phoneVerified: false, // Reset verification when phone changes
              },
            })
          }

    // Generate and store verification code (use formatted phone for consistency)
    const code = await generateVerificationCode(auth.userId, 'PHONE', formattedPhone)

    // Send SMS via Twilio (will format again, but that's okay for consistency)
    const smsResult = await sendVerificationCodeSMS(formattedPhone, code)

    if (!smsResult.success) {
      // In development/localhost, still return success but log the code
      const isDevelopment = process.env.NODE_ENV === 'development' || 
                            process.env.NODE_ENV !== 'production' ||
                            process.env.VERCEL_ENV !== 'production'
      
      if (isDevelopment) {
        console.log(`📱 SMS verification code for ${formattedPhone}: ${code}`)
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

    // Return code in development for testing
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                          process.env.NODE_ENV !== 'production' ||
                          process.env.VERCEL_ENV !== 'production'
    
    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your phone',
      code: isDevelopment ? code : undefined, // Only return code in development for testing
    })
  } catch (error: any) {
    console.error('Send phone verification error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
