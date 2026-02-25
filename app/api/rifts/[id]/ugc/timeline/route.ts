/**
 * Deal timeline events (UGC audit log).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const milestoneId = searchParams.get('milestoneId')

    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      select: { buyerId: true, sellerId: true },
    })
    if (!rift) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    if (rift.buyerId !== auth.userId && rift.sellerId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const events = await prisma.dealTimelineEvent.findMany({
      where: { riftId: id },
      orderBy: { createdAt: 'asc' },
    })

    const filtered = milestoneId
      ? events.filter((e) => (e.metadataJson as Record<string, unknown>)?.milestoneId === milestoneId)
      : events

    return NextResponse.json({ events: filtered })
  } catch (error: any) {
    console.error('UGC timeline error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
