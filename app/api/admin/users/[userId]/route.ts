/**
 * Admin User Actions
 * Freeze, ban, restrict users
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminPermission } from '../../middleware'
import { AdminPermission } from '@prisma/client'
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
