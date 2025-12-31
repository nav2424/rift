/**
 * Verification middleware
 * Ensures users have verified email and phone before accessing protected routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from './mobile-auth'
import { prisma } from './prisma'

/**
 * Checks if user has verified email and phone
 * Returns null if verified, or an error response if not verified
 */
export async function requireVerification(request: NextRequest): Promise<NextResponse | null> {
  const auth = await getAuthenticatedUser(request)
  
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      role: true,
      emailVerified: true,
      phoneVerified: true,
    },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    )
  }

  // ADMIN users can bypass verification requirements
  if (user.role !== 'ADMIN' && (!user.emailVerified || !user.phoneVerified)) {
    return NextResponse.json(
      {
        error: 'VERIFICATION_REQUIRED',
        message: 'Email and phone verification required to access this resource',
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
      { status: 403 }
    )
  }

  return null // User is verified
}

