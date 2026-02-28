import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { withRateLimit } from '@/lib/api-middleware'
import { generateVerificationCode } from '@/lib/verification-codes'
import { sendEmail } from '@/lib/email'
import { sendVerificationCodeSMS, formatPhoneNumber, validatePhoneNumber } from '@/lib/sms'
import { validatePassword } from '@/lib/password-validation'
import { createSignupSession, setSignupPassword } from '@/lib/signup-session'

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstName, lastName, birthday, email, password, confirmPassword, phone } = body

    // Validation
    if (!firstName || !firstName.trim()) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      )
    }

    if (!lastName || !lastName.trim()) {
      return NextResponse.json(
        { error: 'Last name is required' },
        { status: 400 }
      )
    }

    if (!birthday) {
      return NextResponse.json(
        { error: 'Birthday is required' },
        { status: 400 }
      )
    }

    // Validate birthday (must be at least 13 years old)
    const birthDate = new Date(birthday)
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age
    
    if (actualAge < 13) {
      return NextResponse.json(
        { error: 'You must be at least 13 years old to sign up' },
        { status: 400 }
      )
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      )
    }

    // Validate password requirements
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] || 'Password does not meet requirements' },
        { status: 400 }
      )
    }

    // Phone number is required for signup
    if (!phone || phone.trim().length === 0) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Validate and format phone number
    const validation = validatePhoneNumber(phone)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid phone number format. Please include country code (e.g., +1 for US/Canada)' },
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

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Combine firstName and lastName into name
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

    // Create signup session (NO USER CREATED YET - user will be created only after verifications complete)
    let sessionId: string
    try {
      sessionId = await createSignupSession({
        email,
        phone: formattedPhone,
        firstName,
        lastName,
        name: fullName,
        birthday: new Date(birthday),
      })
    } catch (error: any) {
      if (error.message.includes('already registered')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
      throw error
    }

    // Set password in signup session
    await setSignupPassword(sessionId, passwordHash)

    // Generate and send email verification code (linked to session, not user)
    const emailCode = await generateVerificationCode(sessionId, 'EMAIL', email, true)
    const emailHtml = `
      <h2>Verify Your Email</h2>
      <p>Your verification code is: <strong>${emailCode}</strong></p>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `
    await sendEmail(email, 'Verify Your Email - Rift', emailHtml)

    // Generate and send phone verification code (linked to session, not user)
    const phoneCode = await generateVerificationCode(sessionId, 'PHONE', formattedPhone, true)
    await sendVerificationCodeSMS(formattedPhone, phoneCode)

    // Return codes in development for testing
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                          process.env.NODE_ENV !== 'production' ||
                          process.env.VERCEL_ENV !== 'production'

    return NextResponse.json(
      { 
        message: 'Signup session created. Please verify your email and phone, then finalize your account.',
        sessionId, // Return sessionId instead of userId
        requiresVerification: true,
        requiresFinalization: true, // User must call finalize-signup after verifications
        // Only return codes in development
        ...(isDevelopment && {
          emailCode,
          phoneCode,
          note: 'Codes returned in development mode only. User account will be created after email+phone verification and finalize-signup call.'
        })
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Signup error:', error)
    // Return more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error?.message || 'Internal server error'
      : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === 'development' ? error?.stack : undefined },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit<any>(handlePOST, { rateLimit: 'auth' })

