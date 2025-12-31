import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { withRateLimit } from '@/lib/api-middleware'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-make-sure-to-change-this'

async function handlePOST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Same validation as NextAuth authorize function
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Use exact same logic as NextAuth authorize() in lib/auth.ts
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        emailVerified: true,
        phoneVerified: true,
      },
    })

    if (!user) {
      // Same error message as website
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Same password comparison as NextAuth
    const isValid = await bcrypt.compare(password, user.passwordHash)

    if (!isValid) {
      // Same error message as website
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check verification status and return specific error codes
    if (!user.emailVerified && !user.phoneVerified) {
      return NextResponse.json(
        { 
          error: 'VERIFICATION_REQUIRED',
          message: 'Email and phone not verified. Please verify both to access the platform.',
          emailVerified: false,
          phoneVerified: false,
        },
        { status: 403 }
      )
    } else if (!user.emailVerified) {
      return NextResponse.json(
        { 
          error: 'EMAIL_NOT_VERIFIED',
          message: 'Email not verified. Please verify your email address to access the platform.',
          emailVerified: false,
          phoneVerified: user.phoneVerified,
        },
        { status: 403 }
      )
    } else if (!user.phoneVerified) {
      return NextResponse.json(
        { 
          error: 'PHONE_NOT_VERIFIED',
          message: 'Phone not verified. Please verify your phone number to access the platform.',
          emailVerified: true,
          phoneVerified: false,
        },
        { status: 403 }
      )
    }

    // Generate JWT token for mobile
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    }, { status: 200 })
  } catch (error) {
    console.error('Mobile sign in error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit(handlePOST, { rateLimit: 'auth' })

