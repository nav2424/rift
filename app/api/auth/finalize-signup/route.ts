import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { validatePassword } from '@/lib/password-validation'
import {
  getSignupSession,
  setSignupPassword,
  isSignupComplete,
} from '@/lib/signup-session'
import { generateNextRiftUserId } from '@/lib/rift-user-id'
import { capturePolicyAcceptance } from '@/lib/policy-acceptance'
import { extractRequestMetadata } from '@/lib/rift-events'
import { randomUUID } from 'crypto'

/**
 * Finalize signup by setting password and creating user account
 * User account is ONLY created after:
 * 1. Email is verified
 * 2. Phone is verified
 * 3. Password is set and confirmed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, password, confirmPassword } = body

    if (!sessionId || !password) {
      return NextResponse.json(
        { error: 'Session ID and password are required' },
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

    // Get signup session
    const session = await getSignupSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Signup session not found or expired' },
        { status: 404 }
      )
    }

    // Verify email and phone are verified
    if (!session.emailVerified || !session.phoneVerified) {
      return NextResponse.json(
        {
          error: 'Email and phone must be verified before setting password',
          emailVerified: session.emailVerified,
          phoneVerified: session.phoneVerified,
        },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Set password in signup session
    await setSignupPassword(sessionId, passwordHash)

    // Verify signup is complete
    const signupComplete = await isSignupComplete(sessionId)
    if (!signupComplete) {
      return NextResponse.json(
        { error: 'Signup is not complete. Please verify all steps.' },
        { status: 400 }
      )
    }

    // Double-check email and phone are not already registered (race condition protection)
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true },
    })

    if (existingUserByEmail) {
      // Clean up signup session
      await prisma.signup_sessions.delete({ where: { id: sessionId } })
      return NextResponse.json(
        { error: 'Email is already registered' },
        { status: 400 }
      )
    }

    if (session.phone) {
      const existingUserByPhone = await prisma.user.findUnique({
        where: { phone: session.phone },
        select: { id: true },
      })

      if (existingUserByPhone) {
        // Clean up signup session
        await prisma.signup_sessions.delete({ where: { id: sessionId } })
        return NextResponse.json(
          { error: 'Phone number is already registered' },
          { status: 400 }
        )
      }
    }

    // Generate Rift user ID
    const riftUserId = await generateNextRiftUserId()

    // NOW create the user account (only after all verifications are complete)
    // Use passwordHash variable directly (we just created it above)
    let user
    try {
      user = await prisma.user.create({
        data: {
          id: randomUUID(),
          name: session.name || `${session.firstName || ''} ${session.lastName || ''}`.trim(),
          email: session.email,
          phone: session.phone || null,
          passwordHash: passwordHash,
          role: 'USER',
          riftUserId,
          emailVerified: true, // Already verified in session
          phoneVerified: true, // Already verified in session
          updatedAt: new Date(),
        },
      })
    } catch (createError: any) {
      // Handle Prisma unique constraint violation
      if (createError.code === 'P2002') {
        const target = createError.meta?.target || []
        if (Array.isArray(target)) {
          if (target.includes('email')) {
            await prisma.signup_sessions.delete({ where: { id: sessionId } })
            return NextResponse.json(
              { error: 'Email is already registered' },
              { status: 400 }
            )
          }
          if (target.includes('phone')) {
            await prisma.signup_sessions.delete({ where: { id: sessionId } })
            return NextResponse.json(
              { error: 'Phone number is already registered' },
              { status: 400 }
            )
          }
        }
        await prisma.signup_sessions.delete({ where: { id: sessionId } })
        return NextResponse.json(
          { error: 'A user with this information already exists' },
          { status: 400 }
        )
      }
      throw createError
    }

    // Capture policy acceptance
    try {
      const requestMeta = extractRequestMetadata(request)
      await capturePolicyAcceptance(user.id, 'signup', requestMeta)
    } catch (error) {
      console.error('Error capturing policy acceptance:', error)
      // Don't fail signup if policy acceptance fails
    }

    // Clean up signup session
    await prisma.signup_sessions.delete({ where: { id: sessionId } })

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      userId: user.id,
      User: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
    })
  } catch (error: any) {
    console.error('Finalize signup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

