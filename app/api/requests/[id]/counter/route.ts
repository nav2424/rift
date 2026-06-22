import { NextRequest, NextResponse } from 'next/server'
import { requireRequestAuth, loadRequestForUser } from '@/lib/request-access'
import { prisma } from '@/lib/prisma'

/** Admin sends counter offer */
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
    const body = await request.json()
    const { counterPricePerVideo, counterMessage } = body

    if (counterPricePerVideo == null) {
      return NextResponse.json({ error: 'counterPricePerVideo is required' }, { status: 400 })
    }

    const existing = await loadRequestForUser(id, result.auth.userId, 'ADMIN')
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.videoRequest.update({
      where: { id },
      data: {
        counterPricePerVideo: Number(counterPricePerVideo),
        counterMessage: counterMessage || null,
        status: 'COUNTER_OFFERED',
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
    console.error('Counter offer error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
