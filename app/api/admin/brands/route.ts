import { NextRequest, NextResponse } from 'next/server'
import { requireRequestAuth } from '@/lib/request-access'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    if (result.auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const brands = await prisma.user.findMany({
      where: {
        videoRequests: { some: {} },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        videoRequests: {
          select: {
            offeredPricePerVideo: true,
            agreedPricePerVideo: true,
            counterPricePerVideo: true,
            videoCount: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const rows = brands.map((b) => {
      const totalSpend = b.videoRequests.reduce((sum, r) => {
        const price = r.agreedPricePerVideo ?? r.counterPricePerVideo ?? r.offeredPricePerVideo
        return sum + price * r.videoCount
      }, 0)
      return {
        id: b.id,
        name: b.name,
        email: b.email,
        joinedAt: b.createdAt,
        totalRequests: b.videoRequests.length,
        totalSpend,
      }
    })

    return NextResponse.json({ brands: rows })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
