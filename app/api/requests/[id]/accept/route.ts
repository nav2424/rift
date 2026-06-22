import { NextRequest, NextResponse } from 'next/server'
import { requireRequestAuth, loadRequestForUser } from '@/lib/request-access'
import { prisma } from '@/lib/prisma'

/** Admin accepts the brand's offered price */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    if (result.auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const existing = await loadRequestForUser(id, result.auth.userId, 'ADMIN')
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!['PENDING_REVIEW', 'NEGOTIATING'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot accept price in current status' }, { status: 400 })
    }

    const updated = await prisma.videoRequest.update({
      where: { id },
      data: {
        agreedPricePerVideo: existing.counterPricePerVideo ?? existing.offeredPricePerVideo,
        counterPricePerVideo: null,
        counterMessage: null,
        status: 'AGREED',
        updatedAt: new Date(),
      },
      include: {
        brand: { select: { id: true, name: true, email: true } },
        milestones: { orderBy: { sortOrder: 'asc' } },
        deliverables: true,
      },
    })

    return NextResponse.json({ request: updated })
  } catch (e) {
    console.error('Accept price error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
