/**
 * Admin API Middleware
 * Wraps admin endpoints with authentication and permission checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, requirePermission, AdminSession } from '@/lib/admin-auth'
import { AdminPermission } from '@prisma/client'

export type AdminHandler = (
  request: NextRequest,
  context: { session: AdminSession; params?: any }
) => Promise<NextResponse>

/**
 * Wrap admin endpoint with authentication
 */
export function withAdminAuth(handler: AdminHandler) {
  return async (request: NextRequest, context?: { params?: any }) => {
    try {
      const session = await requireAdminAuth(request)
      return handler(request, { session, params: context?.params })
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Unauthorized' },
        { status: 401 }
      )
    }
  }
}

/**
 * Wrap admin endpoint with authentication and permission check
 */
export function withAdminPermission(
  permission: AdminPermission | AdminPermission[],
  handler: AdminHandler
) {
  return async (request: NextRequest, context?: { params?: any }) => {
    try {
      const session = await requireAdminAuth(request)
      
      if (Array.isArray(permission)) {
        requireAnyPermission(session, permission)
      } else {
        requirePermission(session, permission)
      }
      
      return handler(request, { session, params: context?.params })
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Unauthorized' },
        { status: 403 }
      )
    }
  }
}

// Import requireAnyPermission
import { requireAnyPermission } from '@/lib/admin-auth'

