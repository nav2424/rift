/**
 * Admin Authentication & Authorization
 * Strict RBAC with MFA, IP allowlisting, and session management
 */

import { prisma } from './prisma'
import { AdminRole, AdminPermission, Prisma } from '@prisma/client'

type AdminUser = Prisma.admin_usersGetPayload<{
  include: {
    admin_user_roles: {
      include: {
        admin_roles: {
          include: {
            admin_role_permissions: {
              include: {
                admin_permissions: true
              }
            }
          }
        }
      }
    }
  }
}>
import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { compare, hash } from 'bcryptjs'
import { authenticator } from 'otplib'

export interface AdminSession {
  adminUserId: string
  email: string
  name: string
  roles: AdminRole[]
  permissions: AdminPermission[]
  isBreakGlass: boolean
  sessionId: string
}

/**
 * Hash IP address for privacy
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

/**
 * Hash user agent for privacy
 */
export function hashUserAgent(userAgent: string): string {
  return createHash('sha256').update(userAgent).digest('hex')
}

/**
 * Check if IP is in allowlist
 */
export function isIpAllowed(ip: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) {
    return true // No restrictions
  }
  
  // Simple CIDR check (for production, use a proper CIDR library)
  for (const allowed of allowlist) {
    if (allowed.includes('/')) {
      // CIDR notation - simplified check
      const [network, prefix] = allowed.split('/')
      // For production, use proper CIDR matching library
      if (ip.startsWith(network.split('.').slice(0, parseInt(prefix) / 8).join('.'))) {
        return true
      }
    } else if (ip === allowed) {
      return true
    }
  }
  
  return false
}

/**
 * Verify admin credentials
 */
export async function verifyAdminCredentials(
  email: string,
  password: string,
  totpCode?: string
): Promise<{ success: boolean; adminUser?: AdminUser; error?: string }> {
  const adminUser = await prisma.admin_users.findUnique({
    where: { email },
    include: {
      admin_user_roles: {
        include: {
          admin_roles: {
            include: {
              admin_role_permissions: {
                include: {
                  admin_permissions: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!adminUser) {
    return { success: false, error: 'Invalid credentials' }
  }

  if (!adminUser.isActive) {
    return { success: false, error: 'Account is inactive' }
  }

  // Check if account is locked
  if (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) {
    return { success: false, error: 'Account is locked' }
  }

  // Verify password
  const passwordValid = await compare(password, adminUser.passwordHash)
  if (!passwordValid) {
    // Increment failed attempts
    const newAttempts = adminUser.failedLoginAttempts + 1
    const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null // Lock for 15 min after 5 attempts
    
    await prisma.admin_users.update({
      where: { id: adminUser.id },
      data: {
        failedLoginAttempts: newAttempts,
        lockedUntil: lockUntil,
      },
    })

    return { success: false, error: 'Invalid credentials' }
  }

  // Verify MFA if enabled
  if (adminUser.mfaEnabled && adminUser.mfaSecret) {
    if (!totpCode) {
      return { success: false, error: 'MFA code required' }
    }

    const isValid = authenticator.verify({
      token: totpCode,
      secret: adminUser.mfaSecret,
    })

    if (!isValid) {
      return { success: false, error: 'Invalid MFA code' }
    }
  }

  // Reset failed attempts on successful login
  await prisma.admin_users.update({
    where: { id: adminUser.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  })

  return { success: true, adminUser }
}

/**
 * Create admin session
 */
export async function createAdminSession(
  adminUserId: string,
  ip: string,
  userAgent: string,
  deviceFingerprint?: string
): Promise<string> {
  const adminUser = await prisma.admin_users.findUnique({
    where: { id: adminUserId },
  })

  if (!adminUser) {
    throw new Error('Admin user not found')
  }

  // Check IP allowlist
  if (adminUser.ipAllowlist.length > 0 && !isIpAllowed(ip, adminUser.ipAllowlist)) {
    throw new Error('IP address not allowed')
  }

  // Generate session token
  const sessionToken = createHash('sha256')
    .update(`${adminUserId}-${Date.now()}-${Math.random()}`)
    .digest('hex')

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + adminUser.sessionDurationHours)

  // Create session
  const session = await prisma.admin_sessions.create({
    data: {
      id: crypto.randomUUID(),
      adminUserId,
      sessionToken,
      ipHash: hashIp(ip),
      userAgentHash: hashUserAgent(userAgent),
      deviceFingerprint,
      expiresAt,
    },
  })

  return sessionToken
}

/**
 * Get admin session from token
 */
export async function getAdminSession(
  sessionToken: string
): Promise<AdminSession | null> {
  const session = await prisma.admin_sessions.findUnique({
    where: { sessionToken },
    include: {
      admin_users: {
        include: {
          admin_user_roles: {
            include: {
              admin_roles: {
                include: {
                  admin_role_permissions: {
                    include: {
                      admin_permissions: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!session || !session.isActive) {
    return null
  }

  if (session.expiresAt < new Date()) {
    // Expire session
    await prisma.admin_sessions.update({
      where: { id: session.id },
      data: { isActive: false },
    })
    return null
  }

  // Update last activity
  await prisma.admin_sessions.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  })

  // Collect all permissions from roles
  const permissions = new Set<AdminPermission>()
  for (const userRole of session.admin_users.admin_user_roles) {
    for (const rolePerm of userRole.admin_roles.admin_role_permissions) {
      permissions.add(rolePerm.admin_permissions.name)
    }
  }

  return {
    adminUserId: session.admin_users.id,
    email: session.admin_users.email,
    name: session.admin_users.name,
    roles: session.admin_users.admin_user_roles.map((ur) => ur.admin_roles.name),
    permissions: Array.from(permissions),
    isBreakGlass: session.admin_users.isBreakGlass,
    sessionId: session.id,
  }
}

/**
 * Get admin session from request (cookies)
 */
export async function getAdminSessionFromRequest(
  request: Request
): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('admin_session')?.value

  if (!sessionToken) {
    return null
  }

  return getAdminSession(sessionToken)
}

/**
 * Require admin authentication middleware
 */
export async function requireAdminAuth(
  request: Request
): Promise<AdminSession> {
  const session = await getAdminSessionFromRequest(request)

  if (!session) {
    throw new Error('Unauthorized: Admin session required')
  }

  return session
}

/**
 * Require specific permission
 */
export function requirePermission(
  session: AdminSession,
  permission: AdminPermission
): void {
  if (!session.permissions.includes(permission)) {
    throw new Error(`Unauthorized: Permission ${permission} required`)
  }
}

/**
 * Require any of the specified permissions
 */
export function requireAnyPermission(
  session: AdminSession,
  permissions: AdminPermission[]
): void {
  const hasPermission = permissions.some((p) => session.permissions.includes(p))
  if (!hasPermission) {
    throw new Error(`Unauthorized: One of these permissions required: ${permissions.join(', ')}`)
  }
}

/**
 * Require specific role
 */
export function requireRole(session: AdminSession, role: AdminRole): void {
  if (!session.roles.includes(role)) {
    throw new Error(`Unauthorized: Role ${role} required`)
  }
}

/**
 * Check if admin has permission
 */
export function hasPermission(
  session: AdminSession,
  permission: AdminPermission
): boolean {
  return session.permissions.includes(permission)
}

/**
 * Check if admin has any of the permissions
 */
export function hasAnyPermission(
  session: AdminSession,
  permissions: AdminPermission[]
): boolean {
  return permissions.some((p) => session.permissions.includes(p))
}

/**
 * Require re-authentication for high-risk actions
 */
export async function requireReAuth(
  session: AdminSession,
  password: string
): Promise<boolean> {
  const adminUser = await prisma.admin_users.findUnique({
    where: { id: session.adminUserId },
  })

  if (!adminUser) {
    return false
  }

  return compare(password, adminUser.passwordHash)
}

