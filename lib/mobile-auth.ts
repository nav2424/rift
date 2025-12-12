import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { verifyJWT, JWTPayload } from './jwt-middleware'

export interface AuthResult {
  userId: string
  userRole: 'USER' | 'ADMIN'
  isMobile: boolean
}

/**
 * Gets authenticated user from either JWT (mobile) or session (web)
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthResult | null> {
  // Try JWT first (for mobile)
  console.log('getAuthenticatedUser: Checking JWT...')
  const jwtPayload = await verifyJWT(request)
  if (jwtPayload) {
    console.log('getAuthenticatedUser: JWT auth successful')
    return {
      userId: jwtPayload.id,
      userRole: jwtPayload.role,
      isMobile: true,
    }
  }
  console.log('getAuthenticatedUser: JWT auth failed, trying session...')

  // Fall back to session (for web)
  // In Next.js App Router, getServerSession automatically reads cookies from the request context
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    console.log('getAuthenticatedUser: Session auth successful')
    return {
      userId: session.user.id,
      userRole: session.user.role || 'USER',
      isMobile: false,
    }
  }

  console.log('getAuthenticatedUser: Both JWT and session auth failed')
  return null
}

