/**
 * Admin Audit Logging
 * Immutable audit trail for all admin actions
 */

import { prisma } from './prisma'
import { AdminAuditAction, AdminPermission } from '@prisma/client'
import { hashIp, hashUserAgent } from './admin-auth'

export interface AuditLogInput {
  adminUserId: string
  action: AdminAuditAction
  objectType?: string
  objectId?: string
  beforeState?: any
  afterState?: any
  reasonCode?: string
  notes?: string
  ip?: string
  userAgent?: string
  sessionId?: string
}

/**
 * Log an admin action
 */
export async function logAdminAction(input: AuditLogInput): Promise<string> {
  const auditLog = await prisma.admin_audit_logs.create({
    data: {
      id: crypto.randomUUID(),
      adminUserId: input.adminUserId,
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId,
      beforeState: input.beforeState ? JSON.parse(JSON.stringify(input.beforeState)) : null,
      afterState: input.afterState ? JSON.parse(JSON.stringify(input.afterState)) : null,
      reasonCode: input.reasonCode,
      notes: input.notes,
      ipHash: input.ip ? hashIp(input.ip) : null,
      userAgentHash: input.userAgent ? hashUserAgent(input.userAgent) : null,
      sessionId: input.sessionId,
      timestampUtc: new Date(),
    },
  })

  // If break-glass account, trigger alerts
  const adminUser = await prisma.admin_users.findUnique({
    where: { id: input.adminUserId },
    select: { isBreakGlass: true, email: true },
  })

  if (adminUser?.isBreakGlass) {
    // TODO: Send alert to security team
    console.warn(`⚠️ BREAK-GLASS ACCESS: ${adminUser.email} performed ${input.action}`)
  }

  return auditLog.id
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters: {
  adminUserId?: string
  action?: AdminAuditAction
  objectType?: string
  objectId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const logs = await prisma.admin_audit_logs.findMany({
    where: {
      adminUserId: filters.adminUserId,
      action: filters.action,
      objectType: filters.objectType,
      objectId: filters.objectId,
      timestampUtc: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    },
      include: {
        admin_users: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: { timestampUtc: 'desc' },
    take: filters.limit || 100,
    skip: filters.offset || 0,
  })

  return logs
}

/**
 * Get audit log for a specific object
 */
export async function getObjectAuditLog(
  objectType: string,
  objectId: string
) {
  return getAuditLogs({
    objectType,
    objectId,
    limit: 1000,
  })
}

