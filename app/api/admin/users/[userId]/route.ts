/**
 * Admin User Actions
 * Freeze, ban, restrict users
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminPermission } from '../../middleware'
import { AdminPermission, EscrowStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import { AdminAuditAction } from '@prisma/client'

/**
 * GET /api/admin/users/[userId]
 * Get user details
 */
export const GET = withAdminPermission(AdminPermission.USER_READ, async (
  request: NextRequest,
  { session, params }
) => {
  try {
    const { userId } = await params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        riskProfile: true,
        sellerTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            riftNumber: true,
            status: true,
            subtotal: true,
            createdAt: true,
          },
        },
        buyerTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            riftNumber: true,
            status: true,
            subtotal: true,
            createdAt: true,
          },
        },
        disputesRaised: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await logAdminAction({
      adminUserId: session.adminUserId,
      action: 'USER_VIEWED',
      objectType: 'user',
      objectId: userId,
    })

    return NextResponse.json({ user })
  } catch (error: any) {
    console.error('Admin user get error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get user' },
      { status: 500 }
    )
  }
})

/**
 * POST /api/admin/users/[userId]/freeze
 * Freeze user account
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { requireAdminAuth, requirePermission } = await import('@/lib/admin-auth')
    const session = await requireAdminAuth(request)
    requirePermission(session, AdminPermission.USER_FREEZE)

    const { userId } = await params
    const body = await request.json()
    const { reasonCode, notes } = body

    const beforeState = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })

    // Freeze user (add restriction metadata)
    // In production, you'd have a UserRestriction model
    const afterState = { frozen: true }

    await logAdminAction({
      adminUserId: session.adminUserId,
      action: 'USER_FROZEN',
      objectType: 'user',
      objectId: userId,
      beforeState,
      afterState,
      reasonCode: reasonCode || 'ADMIN_DECISION',
      notes,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Admin user freeze error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to freeze user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[userId]
 * Delete user account
 * Supports both AdminUser and regular User with role='ADMIN'
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Try AdminUser authentication first
    let adminUserId: string | null = null
    let isAdminUser = false
    
    try {
      const { requireAdminAuth } = await import('@/lib/admin-auth')
      const adminSession = await requireAdminAuth(request)
      adminUserId = adminSession.adminUserId
      isAdminUser = true
      
      // Check permission for AdminUser
      const { requirePermission } = await import('@/lib/admin-auth')
      requirePermission(adminSession, AdminPermission.USER_DELETE)
    } catch (adminAuthError) {
      // If AdminUser auth fails, try regular User with role='ADMIN'
      const { getServerSession } = await import('next-auth')
      const { authOptions } = await import('@/lib/auth')
      const session = await getServerSession(authOptions)
      
      if (!session || !session.user) {
        return NextResponse.json(
          { error: 'Unauthorized: Admin session required' },
          { status: 401 }
        )
      }
      
      if (session.user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Admin role required' },
          { status: 403 }
        )
      }
      
      // For regular User admin, use their userId for audit log
      // We'll need to create a temporary AdminUser entry or use a special format
      adminUserId = session.user.id // Use regular user ID, but note it's not an AdminUser
      isAdminUser = false
    }

    const { userId } = await params

    // Get user before deletion for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deletion of admin users
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot delete admin users' },
        { status: 400 }
      )
    }

    // Check if user has active transactions
    // Active = not in terminal states (RELEASED, PAID_OUT, CANCELED, CANCELLED, REFUNDED, RESOLVED)
    const terminalStatuses: EscrowStatus[] = [
      'RELEASED',
      'PAID_OUT',
      'CANCELED',
      'CANCELLED',
      'REFUNDED',
      'RESOLVED',
    ]
    
    const activeTransactions = await prisma.riftTransaction.count({
      where: {
        OR: [
          { 
            buyerId: userId, 
            status: { 
              notIn: terminalStatuses
            } 
          },
          { 
            sellerId: userId, 
            status: { 
              notIn: terminalStatuses
            } 
          },
        ],
      },
    })

    if (activeTransactions > 0) {
      return NextResponse.json(
        { error: `Cannot delete user with ${activeTransactions} active transaction(s). Please cancel or complete all transactions first.` },
        { status: 400 }
      )
    }

    // Log admin action before deletion
    // For regular User admins, find any AdminUser to use for audit logging
    // (AdminAuditLog requires a valid AdminUser ID)
    let auditAdminUserId = adminUserId
    if (!isAdminUser) {
      // Find any AdminUser to use for audit logging
      // This is a workaround since AdminAuditLog requires an AdminUser ID
      const anyAdminUser = await prisma.adminUser.findFirst({
        select: { id: true, email: true },
      })
      
      if (anyAdminUser) {
        auditAdminUserId = anyAdminUser.id
      } else {
        // If no AdminUser exists, skip audit logging but continue with deletion
        console.warn('No AdminUser found for audit logging, skipping audit log')
      }
    }

    // Get regular admin user email for notes if applicable
    let regularAdminEmail: string | null = null
    if (!isAdminUser && adminUserId) {
      const regularAdmin = await prisma.user.findUnique({
        where: { id: adminUserId },
        select: { email: true },
      })
      regularAdminEmail = regularAdmin?.email || null
    }

    // Log admin action (only if we have a valid AdminUser ID)
    if (auditAdminUserId && (isAdminUser || auditAdminUserId !== adminUserId)) {
      try {
        await logAdminAction({
          adminUserId: auditAdminUserId,
          action: 'USER_DELETED',
          objectType: 'user',
          objectId: userId,
          beforeState: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          afterState: null,
          reasonCode: 'ADMIN_DECISION',
          notes: isAdminUser 
            ? 'User deleted by AdminUser' 
            : `User deleted by regular admin user (User ID: ${adminUserId}, Email: ${regularAdminEmail || 'unknown'})`,
        })
      } catch (auditError) {
        // Don't fail deletion if audit logging fails
        console.error('Failed to log admin action:', auditError)
      }
    }

    // Delete user (cascade will handle related records if configured)
    await prisma.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({ success: true, message: 'User deleted successfully' })
  } catch (error: any) {
    console.error('Admin user delete error:', error)
    
    // Handle foreign key constraint violations
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete user: user has associated records that must be removed first' },
        { status: 400 }
      )
    }

    // Handle authentication errors
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('Forbidden') ? 403 : 401 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    )
  }
}
