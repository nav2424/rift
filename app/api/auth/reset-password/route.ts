import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Find the reset token
    const verification = await prisma.verificationCode.findFirst({
      where: {
        code: token,
        type: 'PASSWORD_RESET',
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!verification) {
      return NextResponse.json(
        { error: 'Invalid reset token' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date() > verification.expiresAt) {
      // Delete expired token
      await prisma.verificationCode.delete({
        where: { id: verification.id },
      })
      return NextResponse.json(
        { error: 'Reset token has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check if too many attempts
    if (verification.attempts >= 5) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new reset link.' },
        { status: 400 }
      )
    }

    // Verify token matches
    if (verification.code !== token) {
      // Increment attempts
      await prisma.verificationCode.update({
        where: { id: verification.id },
        data: {
          attempts: { increment: 1 },
        },
      })
      return NextResponse.json(
        { error: 'Invalid reset token' },
        { status: 400 }
      )
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12)

    // Update user password
    // verification.userId should always be set for password reset (not a signup session)
    if (!verification.userId) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: verification.userId },
      data: {
        passwordHash,
      },
    })

    // Delete the used reset token
    await prisma.verificationCode.delete({
      where: { id: verification.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
    })
  } catch (error: any) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

