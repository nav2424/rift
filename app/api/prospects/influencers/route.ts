import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

/** GET - List influencer prospects for the current brand */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { platformRole: true, BrandProfile: { select: { id: true } } },
    })
    const isBrand = (user as any)?.platformRole === 'BRAND' || (user as any)?.BrandProfile != null
    if (!isBrand) {
      return NextResponse.json({ error: 'Brand account required' }, { status: 403 })
    }

    const status = request.nextUrl.searchParams.get('status') // PENDING | WORKING | all

    const where: { brandId: string; status?: string } = { brandId: auth.userId }
    if (status && status !== 'all') where.status = status

    const prospects = await prisma.influencerProspect.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ prospects })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** POST - Create a new influencer prospect */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { platformRole: true, BrandProfile: { select: { id: true } } },
    })
    const isBrand = (user as any)?.platformRole === 'BRAND' || (user as any)?.BrandProfile != null
    if (!isBrand) {
      return NextResponse.json({ error: 'Brand account required' }, { status: 403 })
    }

    const body = await request.json()
    const { email, handle, name } = body

    const prospect = await prisma.influencerProspect.create({
      data: {
        brandId: auth.userId,
        email: email || null,
        handle: handle || null,
        name: name || null,
        status: 'PENDING',
      },
    })

    return NextResponse.json({ prospect })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
