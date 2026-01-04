import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination'

/**
 * Get user's payout/withdrawal history
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { page, limit, skip } = parsePaginationParams(request)

    const total = await prisma.payout.count({
      where: { userId: auth.userId },
    })

    const payouts = await prisma.payout.findMany({
      where: { userId: auth.userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        RiftTransaction: {
          select: {
            id: true,
            riftNumber: true,
            itemTitle: true,
          },
        },
      },
    })

    return NextResponse.json(createPaginatedResponse(payouts, page, limit, total))
  } catch (error: any) {
    console.error('Get payouts error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

