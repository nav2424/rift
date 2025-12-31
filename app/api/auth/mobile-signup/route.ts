import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { generateNextRiftUserId } from '@/lib/rift-user-id'
import { capturePolicyAcceptance } from '@/lib/policy-acceptance'
import { extractRequestMetadata } from '@/lib/rift-events'
import { withRateLimit } from '@/lib/api-middleware'
import { generateVerificationCode } from '@/lib/verification-codes'
import { sendEmail } from '@/lib/email'
import { sendVerificationCodeSMS, formatPhoneNumber, validatePhoneNumber } from '@/lib/sms'
import { validatePassword } from '@/lib/password-validation'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-make-sure-to-change-this'

async function handlePOST(request: NextRequest) {
  try {
    const { firstName, lastName, birthday, email, password, phone } = await request.json()

    // Same validation as website signup
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

    // Check if user exists by email
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

    // Hash password - same method as website
    const passwordHash = await bcrypt.hash(password, 10)

    // Generate Rift user ID
    const riftUserId = await generateNextRiftUserId()

    // Combine firstName and lastName into name
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

    // Create user - same as website
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
          role: 'USER', // Explicitly set role like website does
          riftUserId,
          emailVerified: false, // Must verify before accessing platform
          phoneVerified: false, // Must verify before accessing platform
        },
      })
    } catch (createError: any) {
      // Handle Prisma unique constraint violation (email already exists)
      if (createError.code === 'P2002' && createError.meta?.target?.includes('email')) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
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

    // Generate JWT token (user will need to verify before accessing platform)
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    // Return codes in development for testing
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                          process.env.NODE_ENV !== 'production' ||
                          process.env.VERCEL_ENV !== 'production'

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: false,
        phoneVerified: false,
      },
      token,
      requiresVerification: true,
      // Only return codes in development
      ...(isDevelopment && {
        emailCode,
        phoneCode,
        note: 'Codes returned in development mode only'
      })
    })
  } catch (error) {
    console.error('Mobile sign up error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit<any>(handlePOST, { rateLimit: 'auth' })

