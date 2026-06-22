import { NextRequest, NextResponse } from 'next/server'
import { requireRequestAuth, loadRequestForUser } from '@/lib/request-access'
import { prisma } from '@/lib/prisma'

type Action = 'in_production' | 'delivered' | 'closed'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { id } = await params
    const body = await request.json()
    const { action } = body as { action: Action }

    const existing = await loadRequestForUser(id, result.auth.userId, result.auth.userRole)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let status = existing.status

    if (action === 'in_production') {
      if (result.auth.userRole !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!['AGREED', 'IN_PRODUCTION'].includes(existing.status)) {
        return NextResponse.json({ error: 'Price must be agreed first' }, { status: 400 })
      }
      status = 'IN_PRODUCTION'
    } else if (action === 'delivered') {
      if (result.auth.userRole !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      status = 'DELIVERED'
    } else if (action === 'closed') {
      if (existing.brandId !== result.auth.userId && result.auth.userRole !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (existing.status !== 'DELIVERED') {
        return NextResponse.json({ error: 'Request must be delivered first' }, { status: 400 })
      }
      status = 'CLOSED'
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await prisma.videoRequest.update({
      where: { id },
      data: { status, updatedAt: new Date() },
      include: {
        brand: { select: { id: true, name: true, email: true } },
        milestones: { orderBy: { sortOrder: 'asc' } },
        deliverables: { orderBy: { uploadedAt: 'desc' } },
      },
    })

    return NextResponse.json({ request: updated })
  } catch (e) {
    console.error('Status action error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
