import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

/** PATCH - Update prospect (e.g. change status to WORKING) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const { status, email, handle, name } = body

    const prospect = await prisma.influencerProspect.findFirst({
      where: { id, brandId: auth.userId },
    })
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (email !== undefined) updateData.email = email
    if (handle !== undefined) updateData.handle = handle
    if (name !== undefined) updateData.name = name

    const updated = await prisma.influencerProspect.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ prospect: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** DELETE - Remove prospect */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const prospect = await prisma.influencerProspect.findFirst({
      where: { id, brandId: auth.userId },
    })
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
    }

    await prisma.influencerProspect.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
