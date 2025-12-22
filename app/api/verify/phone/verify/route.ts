import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { verifyCode } from '@/lib/verification-codes'

/**
 * Verify phone with code
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
        phone: true,
        phoneVerified: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.phone) {
      return NextResponse.json(
        { error: 'Phone number not set. Please add a phone number first.' },
        { status: 400 }
      )
    }

    if (user.phoneVerified) {
      return NextResponse.json(
        { error: 'Phone number is already verified' },
        { status: 400 }
      )
    }

    // Verify the code
    const verification = await verifyCode(auth.userId, 'PHONE', code)

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.reason || 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Mark phone as verified
    await prisma.user.update({
      where: { id: auth.userId },
      data: {
        phoneVerified: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully',
    })
  } catch (error: any) {
    console.error('Verify phone error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
