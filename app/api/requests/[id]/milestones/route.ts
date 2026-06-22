import { NextRequest, NextResponse } from 'next/server'
import { requireRequestAuth, loadRequestForUser } from '@/lib/request-access'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { id } = await params
    const existing = await loadRequestForUser(id, result.auth.userId, result.auth.userRole)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ milestones: existing.milestones })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const { label, sortOrder } = body

    if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 })

    const count = await prisma.requestMilestone.count({ where: { requestId: id } })

    const milestone = await prisma.requestMilestone.create({
      data: {
        id: randomUUID(),
        requestId: id,
        label,
        sortOrder: sortOrder ?? count,
      },
    })

    return NextResponse.json({ milestone }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
