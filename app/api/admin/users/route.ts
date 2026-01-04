/**
 * Admin Users Module
 * Search and manage users
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminPermission } from '../middleware'
import { AdminPermission } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import { AdminAuditAction } from '@prisma/client'

/**
 * GET /api/admin/users
 * Search users
 */
export const GET = withAdminPermission(AdminPermission.USER_READ, async (
  request: NextRequest,
  { session }
) => {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { riftUserId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          UserRiskProfile: true,
          _count: {
            select: {
              sellerTransactions: true,
              buyerTransactions: true,
            },
          },
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ])

    // Log view
    await logAdminAction({
      adminUserId: session.adminUserId,
      action: 'USER_VIEWED',
      reasonCode: 'SEARCH',
      notes: `Searched users: ${search || 'all'}`,
    })

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        riftUserId: u.riftUserId,
        riskProfile: u.UserRiskProfile,
        stats: {
          sellerTransactions: u._count.sellerTransactions,
          buyerTransactions: u._count.buyerTransactions,
        },
        createdAt: u.createdAt,
      })),
      total,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('Admin users search error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search users' },
      { status: 500 }
    )
  }
})
