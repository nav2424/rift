/**
 * Open UGC dispute on a milestone.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { openDispute, UGC_DISPUTE_REASON_CODES } from '@/lib/ugc/disputes'
import type { UGCDisputeReasonCode } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { milestoneId, reasonCode, description } = body

    if (!milestoneId || !reasonCode || !description?.trim()) {
      return NextResponse.json(
        { error: 'milestoneId, reasonCode, and description are required' },
        { status: 400 }
      )
    }

    if (!UGC_DISPUTE_REASON_CODES.includes(reasonCode as UGCDisputeReasonCode)) {
      return NextResponse.json(
        { error: 'Invalid reasonCode', allowed: UGC_DISPUTE_REASON_CODES },
        { status: 400 }
      )
    }

    const result = await openDispute({
      riftId: id,
      milestoneId,
      openedById: auth.userId,
      reasonCode: reasonCode as UGCDisputeReasonCode,
      description: description.trim(),
    })

    return NextResponse.json({ disputeId: result.disputeId }, { status: 201 })
  } catch (error: any) {
    console.error('UGC open dispute error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { prisma } = await import('@/lib/prisma')
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      select: { buyerId: true, sellerId: true },
    })
    if (!rift) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    if (rift.buyerId !== auth.userId && rift.sellerId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const disputes = await prisma.dispute.findMany({
      where: { escrowId: id },
      include: { Milestone: { select: { id: true, title: true, index: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ disputes })
  } catch (error: any) {
    console.error('UGC list disputes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
