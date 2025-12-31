import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { generateNextRiftUserId } from '@/lib/rift-user-id'
import { generateVerificationCode } from '@/lib/verification-codes'
import { sendEmail } from '@/lib/email'

/**
 * Create a temporary account during signup (before password is set)
 * This allows us to send verification codes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstName, lastName, birthday, email } = body

    // Validation
    if (!firstName || !lastName || !birthday || !email) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    // Generate temporary password (user will set real password later)
    const tempPassword = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    // If user exists, reject (email already registered)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email is already registered' },
        { status: 400 }
      )
    }

    // Generate Rift user ID for new user
    const riftUserId = await generateNextRiftUserId()

    // Create new user with temporary password (signup not completed yet)
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email,
        phone: '', // Will be set later
        passwordHash,
        role: 'USER',
        riftUserId,
        emailVerified: false,
        phoneVerified: false,
        updatedAt: new Date(),
      },
    })
      // Generate Rift user ID for new user
      const riftUserId = await generateNextRiftUserId()

      // Create new user with temporary password (signup not completed yet)
      user = await prisma.user.create({
        data: {
          id: randomUUID(),
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          email,
          phone: '', // Will be set later
          passwordHash,
          role: 'USER',
          riftUserId,
          emailVerified: false,
          phoneVerified: false,
          updatedAt: new Date(),
        },
      })
    }

    // Generate and send email verification code
    const emailCode = await generateVerificationCode(user.id, 'EMAIL', email)
    const emailHtml = `
      <h2>Verify Your Email</h2>
      <p>Your verification code is: <strong>${emailCode}</strong></p>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `
    const emailSent = await sendEmail(email, 'Verify Your Email - Rift', emailHtml)

    const isDevelopment = process.env.NODE_ENV === 'development' || 
                          process.env.NODE_ENV !== 'production' ||
                          process.env.VERCEL_ENV !== 'production'

    // Log status
    if (emailSent) {
      console.log('✅ Verification email sent successfully to:', email)
    } else {
      console.warn('⚠️ Email not sent. SMTP may not be configured. Check SMTP_USER and SMTP_PASSWORD in .env.local')
      if (isDevelopment) {
        console.warn('   Dev code:', emailCode)
      }
    }

    return NextResponse.json({
      userId: user.id,
      // Only return code in development if email failed to send (for testing purposes only)
      emailCode: !emailSent && isDevelopment ? emailCode : undefined,
      emailSent,
      message: emailSent 
        ? 'Account created. Please check your email for the verification code.'
        : (isDevelopment 
          ? 'Account created. Email not sent (SMTP not configured). Check console for verification code.'
          : 'Account created. Please verify your email.'),
    }, { status: 201 })
  } catch (error: any) {
    console.error('Create signup account error:', error)
    
    // Handle Prisma unique constraint violation (email already exists)
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
      
      if (existingUser) {
        return NextResponse.json(
          { error: 'Email is already registered' },
          { status: 400 }
        )
      }
      
      // If it's an incomplete signup, try to update it instead
      // This shouldn't happen since we handle it above, but just in case of race conditions
      return NextResponse.json(
        { error: 'An account with this email is already being created. Please try again.' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

