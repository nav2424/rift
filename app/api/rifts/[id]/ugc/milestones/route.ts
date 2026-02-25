/**
 * List UGC milestones for a deal.
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
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      include: {
        Milestone: {
          orderBy: { index: 'asc' },
          include: {
            MilestoneDelivery: { orderBy: { createdAt: 'desc' }, take: 5 },
            MilestoneRevision: { orderBy: { createdAt: 'desc' } },
            Dispute: { where: { status: { in: ['OPEN', 'NEGOTIATION', 'ADMIN_REVIEW'] } } },
          },
        },
      },
    })

    if (!rift) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    if (rift.buyerId !== auth.userId && rift.sellerId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ milestones: rift.Milestone })
  } catch (error: any) {
    console.error('UGC milestones list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
