import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { verifyCode } from '@/lib/verification-codes'

/**
 * Verify email with code
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code } = body

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Valid 6-digit code is required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        emailVerified: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Verify the code
    const verification = await verifyCode(auth.userId, 'EMAIL', code)

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.reason || 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: auth.userId },
      data: {
        emailVerified: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    })
  } catch (error: any) {
    console.error('Verify email error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
