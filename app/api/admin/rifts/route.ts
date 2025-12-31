/**
 * Admin Rifts Module
 * List and filter rifts
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminPermission } from '../middleware'
import { AdminPermission, EscrowStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'

/**
 * GET /api/admin/rifts
 * List rifts with filters
 */
export const GET = withAdminPermission(AdminPermission.RIFT_READ, async (
  request: NextRequest,
  { session }
) => {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as EscrowStatus | null
    const itemType = searchParams.get('itemType')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const riskScore = searchParams.get('riskScore')
    const flagged = searchParams.get('flagged') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}

    if (status) where.status = status
    if (itemType) where.itemType = itemType
    if (minAmount || maxAmount) {
      where.subtotal = {}
      if (minAmount) where.subtotal.gte = parseFloat(minAmount)
      if (maxAmount) where.subtotal.lte = parseFloat(maxAmount)
    }
    if (riskScore) where.riskScore = { gte: parseInt(riskScore) }
    if (flagged) where.requiresManualReview = true

    const [rifts, total] = await Promise.all([
      prisma.riftTransaction.findMany({
        where,
        include: {
          buyer: {
            select: {
              id: true,
              email: true,
              name: true,
              riftUserId: true,
            },
          },
          seller: {
            select: {
              id: true,
              email: true,
              name: true,
              riftUserId: true,
            },
          },
          _count: {
            select: {
              disputes: true,
              vaultAssets: true,
            },
          },
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.riftTransaction.count({ where }),
    ])

    await logAdminAction({
      adminUserId: session.adminUserId,
      action: 'RIFT_VIEWED',
      reasonCode: 'LIST',
    })

    return NextResponse.json({
      rifts,
      total,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('Admin rifts list error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list rifts' },
      { status: 500 }
    )
  }
})
