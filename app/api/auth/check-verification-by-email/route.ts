import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        phoneVerified: true,
      },
    })

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        emailVerified: false,
        phoneVerified: false,
        allVerified: false,
      })
    }

    return NextResponse.json({
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      allVerified: user.emailVerified && user.phoneVerified,
    })
  } catch (error: any) {
    console.error('Check verification by email error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

