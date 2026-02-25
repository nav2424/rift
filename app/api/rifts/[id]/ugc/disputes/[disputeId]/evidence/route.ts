/**
 * Add evidence to UGC dispute (file, message, delivery, contract, other).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { EvidenceType } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; disputeId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, disputeId } = await params
    const body = await request.json()
    const { type, fileId, messageId, milestoneDeliveryId, url, note } = body

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { RiftTransaction: { select: { buyerId: true, sellerId: true } } },
    })
    if (!dispute || dispute.escrowId !== id) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }
    const rift = dispute.RiftTransaction
    if (!rift || (rift.buyerId !== auth.userId && rift.sellerId !== auth.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!['OPEN', 'NEGOTIATION', 'ADMIN_REVIEW'].includes(dispute.status)) {
      return NextResponse.json({ error: 'Cannot add evidence to resolved dispute' }, { status: 400 })
    }

    const validTypes: EvidenceType[] = ['FILE', 'MESSAGE', 'DELIVERY', 'CONTRACT', 'OTHER']
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid type', allowed: validTypes }, { status: 400 })
    }

    const evidence = await prisma.disputeEvidence.create({
      data: {
        id: crypto.randomUUID(),
        disputeId,
        type,
        fileId: fileId ?? undefined,
        messageId: messageId ?? undefined,
        milestoneDeliveryId: milestoneDeliveryId ?? undefined,
        url: url ?? undefined,
        note: note ?? undefined,
      },
    })

    return NextResponse.json({ evidenceId: evidence.id }, { status: 201 })
  } catch (error: any) {
    console.error('UGC dispute evidence error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; disputeId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, disputeId } = await params
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        RiftTransaction: { select: { buyerId: true, sellerId: true } },
        DisputeEvidence: true,
      },
    })
    if (!dispute || dispute.escrowId !== id) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }
    const rift = dispute.RiftTransaction
    if (!rift || (rift.buyerId !== auth.userId && rift.sellerId !== auth.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ evidence: dispute.DisputeEvidence })
  } catch (error: any) {
    console.error('UGC list evidence error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
