import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

/** GET - List brand prospects for the current creator */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { platformRole: true, CreatorProfile: { select: { id: true } } },
    })
    const isCreator = (user as any)?.platformRole === 'CREATOR' || (user as any)?.CreatorProfile != null
    if (!isCreator) {
      return NextResponse.json({ error: 'Creator account required' }, { status: 403 })
    }

    const status = request.nextUrl.searchParams.get('status') // PENDING | WORKING | all

    const where: { creatorId: string; status?: string } = { creatorId: auth.userId }
    if (status && status !== 'all') where.status = status

    const prospects = await prisma.brandProspect.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ prospects })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** POST - Create a new brand prospect */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { platformRole: true, CreatorProfile: { select: { id: true } } },
    })
    const isCreator = (user as any)?.platformRole === 'CREATOR' || (user as any)?.CreatorProfile != null
    if (!isCreator) {
      return NextResponse.json({ error: 'Creator account required' }, { status: 403 })
    }

    const body = await request.json()
    const { companyName, email, website, name } = body

    const prospect = await prisma.brandProspect.create({
      data: {
        creatorId: auth.userId,
        companyName: companyName || null,
        email: email || null,
        website: website || null,
        name: name || null,
        status: 'PENDING',
      },
    })

    return NextResponse.json({ prospect })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
