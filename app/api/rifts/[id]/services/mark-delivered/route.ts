import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'

/**
 * POST /api/rifts/[id]/services/mark-delivered
 * Seller marks service as delivered
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

    // Get rift and verify seller
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        sellerId: true,
        itemType: true,
        status: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    if (rift.sellerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify category is services
    if (rift.itemType !== 'SERVICES') {
      return NextResponse.json(
        { error: 'This endpoint is only for services' },
        { status: 400 }
      )
    }

    // Verify status allows marking delivered
    if (!['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(rift.status)) {
      return NextResponse.json(
        { error: 'Rift is not in a state that allows marking as delivered' },
        { status: 400 }
      )
    }

    // Update rift status to delivered
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: { status: 'DELIVERED_PENDING_RELEASE' },
    })

    // Log event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      riftId,
      RiftEventActorType.SELLER,
      userId,
      'SELLER_MARKED_DELIVERED',
      {},
      requestMeta
    )

    // Don't post system messages - status updates are visible in the platform and sent via email

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Mark delivered error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

