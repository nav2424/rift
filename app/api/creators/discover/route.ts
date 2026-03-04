import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const niche = searchParams.get('niche')
    const minFollowers = searchParams.get('minFollowers')
    const maxRate = searchParams.get('maxRate')
    const sortBy = searchParams.get('sortBy') || 'followers'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    if (niche) where.niche = niche
    if (minFollowers) where.followers = { gte: parseInt(minFollowers) }
    if (maxRate) where.postRate = { lte: parseFloat(maxRate) }

    const orderBy: any = {}
    if (sortBy === 'followers') orderBy.followers = 'desc'
    else if (sortBy === 'engagement') orderBy.engagementRate = 'desc'
    else if (sortBy === 'rate') orderBy.postRate = 'asc'

    const [creators, total] = await Promise.all([
      prisma.creatorProfile.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, riftUserId: true },
          },
        },
      }),
      prisma.creatorProfile.count({ where }),
    ])

    return NextResponse.json({ creators, total, page, limit })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
