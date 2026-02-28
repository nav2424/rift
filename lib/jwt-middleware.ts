import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export interface JWTPayload {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET or NEXTAUTH_SECRET must be configured')
  }
  return secret
}

export async function verifyJWT(request: NextRequest): Promise<JWTPayload | null> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return null
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  try {
    const secret = getJwtSecret()
    const decoded = jwt.verify(token, secret) as unknown as JWTPayload
    return decoded
  } catch (error: any) {
    console.error('JWT verification failed:', error.message)
    return null
  }
}

