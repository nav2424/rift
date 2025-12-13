import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { transitionRiftState } from '@/lib/rift-state'
import { canBuyerDispute } from '@/lib/state-machine'

/**
 * Open a dispute (buyer action)
 * Can only be opened between FUNDED and before RELEASED
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const rift = await prisma.escrowTransaction.findUnique({
      where: { id },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Verify buyer
    if (rift.buyerId !== auth.userId) {
      return NextResponse.json({ error: 'Only buyer can open dispute' }, { status: 403 })
    }

    // Verify state allows dispute
    if (!canBuyerDispute(rift.status)) {
      return NextResponse.json(
        { error: `Cannot open dispute in ${rift.status} state` },
        { status: 400 }
      )
    }

    // Check if dispute already exists
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        escrowId: rift.id,
        status: 'OPEN',
      },
    })

    if (existingDispute) {
      return NextResponse.json(
        { error: 'Dispute already open for this rift' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { reason, type, evidence } = body

    if (!reason || !type) {
      return NextResponse.json(
        { error: 'Reason and type are required' },
        { status: 400 }
      )
    }

    // Create dispute
    const dispute = await prisma.dispute.create({
      data: {
        escrowId: rift.id,
        raisedById: auth.userId,
        reason,
        type,
        evidence: evidence || {},
        status: 'OPEN',
      },
    })

    // Transition to DISPUTED
    await transitionRiftState(rift.id, 'DISPUTED', { userId: auth.userId })

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: rift.id,
        type: 'DISPUTE_OPENED',
        message: `Dispute opened: ${reason}`,
        createdById: auth.userId,
      },
    })

    return NextResponse.json({
      success: true,
      disputeId: dispute.id,
      status: 'DISPUTED',
    })
  } catch (error: any) {
    console.error('Open dispute error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
