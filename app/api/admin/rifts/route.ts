import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { page, limit, skip } = parsePaginationParams(request)

    // Get total count for pagination
    const total = await prisma.riftTransaction.count()

    const rifts = await prisma.riftTransaction.findMany({
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(createPaginatedResponse(rifts, page, limit, total))
  } catch (error) {
    console.error('Get admin rifts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

