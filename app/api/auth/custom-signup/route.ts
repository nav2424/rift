import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateNextRiftUserId } from '@/lib/rift-user-id'
import { capturePolicyAcceptance } from '@/lib/policy-acceptance'
import { extractRequestMetadata } from '@/lib/rift-events'
import { withRateLimit } from '@/lib/api-middleware'
import { generateVerificationCode } from '@/lib/verification-codes'
import { sendEmail } from '@/lib/email'
import { sendVerificationCodeSMS, formatPhoneNumber, validatePhoneNumber } from '@/lib/sms'
import { validatePassword } from '@/lib/password-validation'

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

    // Check if user already exists by email
    const existingUserByEmail = await prisma.user.findFirst({
      where: { 
        email,
      },
    })

    if (existingUserByEmail) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Check if phone number is already in use
    const existingUserByPhone = await prisma.user.findFirst({
      where: {
        phone: formattedPhone,
      },
    })

    if (existingUserByPhone) {
      return NextResponse.json(
        { error: 'This phone number is already associated with another account' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Generate Rift user ID
    const riftUserId = await generateNextRiftUserId()

    // Combine firstName and lastName into name
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

    // Create user with Rift user ID
    // Note: Email uniqueness is enforced by Prisma @unique constraint
    // If somehow a duplicate email gets through (race condition), Prisma will throw an error
    // User is created with emailVerified and phoneVerified both false - they must verify before accessing platform
    let user
    try {
      user = await prisma.user.create({
        data: {
          name: fullName,
          email,
          phone: formattedPhone,
          passwordHash,
          role: 'USER',
          riftUserId,
          emailVerified: false, // Must verify before accessing platform
          phoneVerified: false, // Must verify before accessing platform
        },
      })
    } catch (createError: any) {
      // Handle Prisma unique constraint violation
      if (createError.code === 'P2002') {
        const target = createError.meta?.target || []
        if (Array.isArray(target)) {
          if (target.includes('email')) {
            return NextResponse.json(
              { error: 'User with this email already exists' },
              { status: 400 }
            )
          }
          if (target.includes('phone')) {
            return NextResponse.json(
              { error: 'This phone number is already associated with another account' },
              { status: 400 }
            )
          }
        }
        // Generic unique constraint error
        return NextResponse.json(
          { error: 'A user with this information already exists' },
          { status: 400 }
        )
      }
      // Re-throw if it's a different error
      throw createError
    }

    // Generate and send email verification code
    const emailCode = await generateVerificationCode(user.id, 'EMAIL', email)
    const emailHtml = `
      <h2>Verify Your Email</h2>
      <p>Your verification code is: <strong>${emailCode}</strong></p>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `
    await sendEmail(email, 'Verify Your Email - Rift', emailHtml)

    // Generate and send phone verification code
    const phoneCode = await generateVerificationCode(user.id, 'PHONE', formattedPhone)
    await sendVerificationCodeSMS(formattedPhone, phoneCode)

    // Capture policy acceptance at signup
    try {
      const requestMeta = extractRequestMetadata(request)
      await capturePolicyAcceptance(user.id, 'signup', requestMeta)
    } catch (error) {
      console.error('Error capturing policy acceptance:', error)
      // Don't fail signup if policy acceptance fails
    }

    // Return codes in development for testing
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                          process.env.NODE_ENV !== 'production' ||
                          process.env.VERCEL_ENV !== 'production'

    return NextResponse.json(
      { 
        message: 'User created successfully. Please verify your email and phone to access the platform.',
        userId: user.id,
        requiresVerification: true,
        // Only return codes in development
        ...(isDevelopment && {
          emailCode,
          phoneCode,
          note: 'Codes returned in development mode only'
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

