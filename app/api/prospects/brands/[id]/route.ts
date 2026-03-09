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
      select: { platformRole: true, CreatorProfile: { select: { id: true } } },
    })
    const isCreator = (user as any)?.platformRole === 'CREATOR' || (user as any)?.CreatorProfile != null
    if (!isCreator) {
      return NextResponse.json({ error: 'Creator account required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, companyName, email, website, name } = body

    const prospect = await prisma.brandProspect.findFirst({
      where: { id, creatorId: auth.userId },
    })
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (companyName !== undefined) updateData.companyName = companyName
    if (email !== undefined) updateData.email = email
    if (website !== undefined) updateData.website = website
    if (name !== undefined) updateData.name = name

    const updated = await prisma.brandProspect.update({
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

    const prospect = await prisma.brandProspect.findFirst({
      where: { id, creatorId: auth.userId },
    })
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
    }

    await prisma.brandProspect.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
