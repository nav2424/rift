import { NextRequest, NextResponse } from 'next/server'
import { requireRequestAuth } from '@/lib/request-access'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    if (result.auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { milestoneId } = await params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.label !== undefined) data.label = body.label
    if (body.completed === true) data.completedAt = new Date()
    if (body.completed === false) data.completedAt = null

    const milestone = await prisma.requestMilestone.update({
      where: { id: milestoneId },
      data,
    })

    return NextResponse.json({ milestone })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    if (result.auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { milestoneId } = await params
    await prisma.requestMilestone.delete({ where: { id: milestoneId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
