import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-make-sure-to-change-this'

export interface JWTPayload {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
}

export async function verifyJWT(request: NextRequest): Promise<JWTPayload | null> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    console.log('JWT: No authorization header found')
    return null
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    console.log('JWT: Authorization header does not start with Bearer:', authHeader.substring(0, 20))
    return null
  }

  const token = authHeader.substring(7)
  console.log('JWT: Token received, length:', token.length)

  try {
    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production-make-sure-to-change-this') {
      console.warn('JWT_SECRET not properly configured. Using default secret.')
    }
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    console.log('JWT: Verification successful for User:', decoded.id)
    return decoded
  } catch (error: any) {
    console.error('JWT verification failed:', error.message, error.name)
    return null
  }
}

