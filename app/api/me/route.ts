import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

/**
 * Get current user information
 * Supports both web (NextAuth) and mobile (JWT) authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Try web session first
    const session = await getServerSession(authOptions)
    let userId: string | null = null

    if (session?.user?.id) {
      userId = session.user.id
    } else {
      // Fallback to mobile auth
      const auth = await getAuthenticatedUser(request)
      if (auth) {
        userId = auth.userId
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        idVerified: true,
        bankVerified: true,
        role: true,
        riftUserId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error: any) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
