import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { postSystemMessage } from '@/lib/rift-messaging'
import { RiftEventActorType } from '@prisma/client'

/**
 * POST /api/rifts/[id]/services/confirm-completion
 * Buyer confirms service completion
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

    // Verify category is services
    if (rift.itemType !== 'SERVICES') {
      return NextResponse.json(
        { error: 'This endpoint is only for services' },
        { status: 400 }
      )
    }

    // Verify status is delivered
    if (rift.status !== 'DELIVERED_PENDING_RELEASE') {
      return NextResponse.json(
        { error: 'Service must be marked as delivered first' },
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

    // Mark as eligible for release (release engine will handle actual release)
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: {
        releaseEligibleAt: new Date(),
      },
    })

    // Post system message
    await postSystemMessage(
      riftId,
      'Buyer confirmed completion.'
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Confirm completion error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

