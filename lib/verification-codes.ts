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
  // Generate 6-digit code
  const code = crypto.randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)

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

  // Store new code
  await prisma.verificationCode.create({
    data: {
      id: randomUUID(),
      userId: isSession ? null : userIdOrSessionId,
      sessionId: isSession ? userIdOrSessionId : null,
      type,
      code,
      contactInfo,
      expiresAt,
      attempts: 0,
    },
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
