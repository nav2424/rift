import { NextRequest, NextResponse } from 'next/server'
import { verifyCode } from '@/lib/verification-codes'
import { markEmailVerified, getSignupSession } from '@/lib/signup-session'

/**
 * Verify email during signup (before user account is created)
 * Accepts sessionId and code - works with SignupSession, not User
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, code } = body

    if (!sessionId || !code) {
      return NextResponse.json(
        { error: 'Session ID and verification code are required' },
        { status: 400 }
      )
    }

    if (code.length !== 6) {
      return NextResponse.json(
        { error: 'Valid 6-digit code is required' },
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

    if (session.emailVerified) {
      return NextResponse.json(
        { error: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Verify the code (using sessionId, not userId)
    const verification = await verifyCode(sessionId, 'EMAIL', code, true)

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.reason || 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Mark email as verified in signup session
    await markEmailVerified(sessionId)

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      sessionId,
    })
  } catch (error: any) {
    console.error('Verify email signup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

