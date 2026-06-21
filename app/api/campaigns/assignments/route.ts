import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isAdmin = auth.userRole === 'ADMIN'
    const where = isAdmin && request.nextUrl.searchParams.get('all') === 'true'
      ? {}
      : { creatorId: auth.userId }

    const assignments = await prisma.creatorAssignment.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            campaignNumber: true,
            productName: true,
            videoFormat: true,
            videoCount: true,
            usageRights: true,
            deadline: true,
            sanitizedBrief: true,
            status: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ assignments })
  } catch (error: unknown) {
    console.error('List assignments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
