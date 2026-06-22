import { NextRequest, NextResponse } from 'next/server'
import { requireRequestAuth, loadRequestForUser } from '@/lib/request-access'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { id } = await params
    const videoRequest = await loadRequestForUser(id, result.auth.userId, result.auth.userRole)
    if (!videoRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const payload = { ...videoRequest }
    if (result.auth.userRole !== 'ADMIN') {
      payload.adminNotes = null
    }

    return NextResponse.json({ request: payload })
  } catch (e) {
    console.error('Get request error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { id } = await params
    const existing = await loadRequestForUser(id, result.auth.userId, result.auth.userRole)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const data: Record<string, unknown> = { updatedAt: new Date() }

    if (result.auth.userRole === 'ADMIN') {
      if (body.adminNotes !== undefined) data.adminNotes = body.adminNotes
      if (body.status) data.status = body.status
    }

    const updated = await prisma.videoRequest.update({
      where: { id },
      data,
      include: {
        brand: { select: { id: true, name: true, email: true } },
        milestones: { orderBy: { sortOrder: 'asc' } },
        deliverables: { orderBy: { uploadedAt: 'desc' } },
      },
    })

    return NextResponse.json({ request: updated })
  } catch (e) {
    console.error('Patch request error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
