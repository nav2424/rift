/**
 * Verification code management
 * Stores and validates email/phone verification codes
 */

import { prisma } from './prisma'
import crypto from 'crypto'
import { randomUUID } from 'crypto'

const CODE_EXPIRY_MINUTES = 15
const MAX_ATTEMPTS = 5

/**
 * Generate and store a verification code
 * Can be used for both existing users (userId) and signup sessions (sessionId)
 */
export async function generateVerificationCode(
  userIdOrSessionId: string,
  type: 'EMAIL' | 'PHONE',
  contactInfo: string, // email or phone number
  isSession: boolean = false // true if userIdOrSessionId is a sessionId
): Promise<string> {
  // Validate input - userIdOrSessionId must be a valid string
  if (!userIdOrSessionId || typeof userIdOrSessionId !== 'string') {
    throw new Error(`generateVerificationCode: invalid userIdOrSessionId (${userIdOrSessionId})`)
  }

  // Generate 6-digit code
  const code = crypto.randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)

  // Prepare data based on whether this is for a session or existing user
  const userId = isSession ? null : userIdOrSessionId
  const sessionId = isSession ? userIdOrSessionId : null

  // Bulletproof guard: ensure at least one of userId or sessionId will be set
  // (This should never fail if userIdOrSessionId is valid, but double-check)
  if (isSession) {
    // For sessions: sessionId must be set, userId must be null
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error(
        `generateVerificationCode blocked: invalid sessionId (${sessionId}). ` +
        `Expected non-null string for signup session verification. ` +
        `userIdOrSessionId: ${userIdOrSessionId}, isSession: ${isSession}`
      )
    }
  } else {
    // For existing users: userId must be set, sessionId must be null
    if (!userId || typeof userId !== 'string') {
      throw new Error(
        `generateVerificationCode blocked: invalid userId (${userId}). ` +
        `Expected non-null string for existing user verification. ` +
        `userIdOrSessionId: ${userIdOrSessionId}, isSession: ${isSession}`
      )
    }
  }

  // Delete any existing codes for this user/session and type
  await prisma.verificationCode.deleteMany({
    where: isSession
      ? {
          sessionId: userIdOrSessionId,
          type,
        }
      : {
          userId: userIdOrSessionId,
          type,
        },
  })

  // Store new code with explicit null handling
  // For sessions: userId must be null, sessionId must be set
  // For users: userId must be set, sessionId must be null
  const createData = {
    id: randomUUID(),
    userId: isSession ? null : userId,
    sessionId: isSession ? sessionId : null,
    type,
    code,
    contactInfo,
    expiresAt,
    attempts: 0,
  }

  // Log for debugging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('Creating verification code:', {
      isSession,
      userId: createData.userId,
      sessionId: createData.sessionId,
      type: createData.type,
    })
  }

  await prisma.verificationCode.create({
    data: createData,
  })

  return code
}

/**
 * Verify a code
 * Can be used for both existing users (userId) and signup sessions (sessionId)
 */
export async function verifyCode(
  userIdOrSessionId: string,
  type: 'EMAIL' | 'PHONE',
  code: string,
  isSession: boolean = false // true if userIdOrSessionId is a sessionId
): Promise<{ valid: boolean; reason?: string }> {
  const verification = await prisma.verificationCode.findFirst({
    where: isSession
      ? {
          sessionId: userIdOrSessionId,
          type,
        }
      : {
          userId: userIdOrSessionId,
          type,
        },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!verification) {
    return { valid: false, reason: 'No verification code found. Please request a new code.' }
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    return { valid: false, reason: 'Too many failed attempts. Please request a new code.' }
  }

  if (new Date() > verification.expiresAt) {
    return { valid: false, reason: 'Verification code has expired. Please request a new code.' }
  }

  if (verification.code !== code) {
    // Increment attempts
    await prisma.verificationCode.update({
      where: { id: verification.id },
      data: {
        attempts: { increment: 1 },
      },
    })
    return { valid: false, reason: 'Invalid verification code.' }
  }

  // Code is valid - delete it
  await prisma.verificationCode.delete({
    where: { id: verification.id },
  })

  return { valid: true }
}

/**
 * Clean up expired codes (can be called periodically)
 */
export async function cleanupExpiredCodes() {
  await prisma.verificationCode.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
}
