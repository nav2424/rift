import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'

/**
 * POST /api/rifts/[id]/dispute/intent
 * Logs that buyer started the dispute flow (soft resistance screen)
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

    const { id: riftId } = await params
    const userId = auth.userId

    // Get rift and verify buyer
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        buyerId: true,
        itemType: true,
        status: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    if (rift.buyerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if rift is in a state that allows disputes
    if (!['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW', 'DELIVERED_PENDING_RELEASE', 'IN_PROGRESS'].includes(rift.status)) {
      return NextResponse.json(
        { error: 'Cannot open dispute in current status' },
        { status: 400 }
      )
    }

    // Log intent event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      riftId,
      RiftEventActorType.BUYER,
      userId,
      'DISPUTE_INTENT_OPENED',
      {},
      requestMeta
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Dispute intent error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

