import { NextRequest, NextResponse } from 'next/server'
import { requireRequestAuth, loadRequestForUser } from '@/lib/request-access'
import { prisma } from '@/lib/prisma'

/** Brand accepts or declines admin counter offer */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { id } = await params
    const body = await request.json()
    const { action } = body as { action: 'accept' | 'decline' }

    const existing = await loadRequestForUser(id, result.auth.userId, result.auth.userRole)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.brandId !== result.auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existing.status !== 'COUNTER_OFFERED') {
      return NextResponse.json({ error: 'No counter offer pending' }, { status: 400 })
    }

    if (action === 'accept') {
      const updated = await prisma.videoRequest.update({
        where: { id },
        data: {
          agreedPricePerVideo: existing.counterPricePerVideo,
          status: 'AGREED',
          updatedAt: new Date(),
        },
        include: {
          milestones: { orderBy: { sortOrder: 'asc' } },
          deliverables: true,
        },
      })
      return NextResponse.json({ request: updated })
    }

    if (action === 'decline') {
      const updated = await prisma.videoRequest.update({
        where: { id },
        data: {
          status: 'NEGOTIATING',
          updatedAt: new Date(),
        },
        include: {
          milestones: { orderBy: { sortOrder: 'asc' } },
          deliverables: true,
        },
      })
      return NextResponse.json({ request: updated })
    }

    return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 })
  } catch (e) {
    console.error('Respond counter error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
