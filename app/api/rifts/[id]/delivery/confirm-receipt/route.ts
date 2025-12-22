import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { postSystemMessage } from '@/lib/rift-messaging'
import { RiftEventActorType } from '@prisma/client'

/**
 * POST /api/rifts/[id]/delivery/confirm-receipt
 * Buyer confirms receipt of digital delivery
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

    // Verify category is digital goods
    if (rift.itemType !== 'DIGITAL') {
      return NextResponse.json(
        { error: 'This endpoint is only for digital goods' },
        { status: 400 }
      )
    }

    // Verify status is delivered
    if (rift.status !== 'DELIVERED_PENDING_RELEASE') {
      return NextResponse.json(
        { error: 'Delivery must be uploaded first' },
        { status: 400 }
      )
    }

    // Log event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      riftId,
      RiftEventActorType.BUYER,
      userId,
      'BUYER_CONFIRMED_RECEIPT',
      {},
      requestMeta
    )

    // Mark as eligible for release
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: {
        releaseEligibleAt: new Date(),
      },
    })

    // Post system message
    await postSystemMessage(
      riftId,
      'Buyer confirmed receipt of digital delivery.'
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Confirm receipt error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

