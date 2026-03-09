import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      platformRole: true,
      BrandProfile: { select: { id: true } },
      CreatorProfile: { select: { id: true } },
    },
  })

  let platformRole = (user as any)?.platformRole || null
  if (!platformRole) {
    if ((user as any)?.BrandProfile) platformRole = 'BRAND'
    else if ((user as any)?.CreatorProfile) platformRole = 'CREATOR'
  }

  return NextResponse.json({ platformRole })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role } = await request.json()
  if (!['CREATOR', 'BRAND'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: { platformRole: role } as any,
  })

  return NextResponse.json({ success: true, platformRole: role })
}
