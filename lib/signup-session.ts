/**
 * Signup Session Management
 * Handles temporary signup data before user account is created
 */

import { prisma } from './prisma'
import { randomUUID } from 'crypto'

const SESSION_EXPIRY_HOURS = 24

/**
 * Create a new signup session
 */
export async function createSignupSession(data: {
  email: string
  phone?: string
  firstName?: string
  lastName?: string
  name?: string
  birthday?: Date
}): Promise<string> {
  // Check if email is already registered (in User table)
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  })

  if (existingUser) {
    throw new Error('Email is already registered')
  }

  // Check if phone is already registered (in User table)
  if (data.phone) {
    const existingUserByPhone = await prisma.user.findUnique({
      where: { phone: data.phone },
      select: { id: true },
    })

    if (existingUserByPhone) {
      throw new Error('Phone number is already registered')
    }
  }

  // Check if there's an existing signup session for this email
  const existingSession = await prisma.signup_sessions.findUnique({
    where: { email: data.email },
  })

  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000)

  if (existingSession) {
    // Update existing session
    // Note: updatedAt is automatically handled by Prisma @updatedAt decorator
    const updated = await prisma.signup_sessions.update({
      where: { id: existingSession.id },
      data: {
        ...data,
        expiresAt,
        emailVerified: false,
        phoneVerified: false,
        passwordSet: false,
      },
    })
    return updated.id
  }

  // Create new session
  const now = new Date()
  const session = await prisma.signup_sessions.create({
    data: {
      id: randomUUID(),
      email: data.email,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      name: data.name,
      birthday: data.birthday,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    },
  })

  return session.id
}

/**
 * Get signup session by ID
 */
export async function getSignupSession(sessionId: string) {
  const session = await prisma.signup_sessions.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return null
  }

  // Check if session expired
  if (new Date() > session.expiresAt) {
    // Delete expired session
    await prisma.signup_sessions.delete({
      where: { id: sessionId },
    })
    return null
  }

  return session
}

/**
 * Mark email as verified in signup session
 */
export async function markEmailVerified(sessionId: string): Promise<boolean> {
  const session = await getSignupSession(sessionId)
  if (!session) {
    return false
  }

  await prisma.signup_sessions.update({
    where: { id: sessionId },
    data: { 
      emailVerified: true,
      // updatedAt is automatically handled by Prisma @updatedAt decorator
    },
  })

  return true
}

/**
 * Mark phone as verified in signup session
 */
export async function markPhoneVerified(sessionId: string): Promise<boolean> {
  const session = await getSignupSession(sessionId)
  if (!session) {
    return false
  }

  await prisma.signup_sessions.update({
    where: { id: sessionId },
    data: { 
      phoneVerified: true,
      // updatedAt is automatically handled by Prisma @updatedAt decorator
    },
  })

  return true
}

/**
 * Set password in signup session
 */
export async function setSignupPassword(sessionId: string, passwordHash: string): Promise<boolean> {
  const session = await getSignupSession(sessionId)
  if (!session) {
    return false
  }

  await prisma.signup_sessions.update({
    where: { id: sessionId },
    data: {
      passwordHash,
      passwordSet: true,
      // updatedAt is automatically handled by Prisma @updatedAt decorator
    },
  })

  return true
}

/**
 * Check if signup session is ready to create user account
 */
export async function isSignupComplete(sessionId: string): Promise<boolean> {
  const session = await getSignupSession(sessionId)
  if (!session) {
    return false
  }

  return (
    session.emailVerified &&
    session.phoneVerified &&
    session.passwordSet &&
    !!session.passwordHash
  )
}

/**
 * Clean up expired signup sessions
 */
export async function cleanupExpiredSessions() {
  await prisma.signup_sessions.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
}

