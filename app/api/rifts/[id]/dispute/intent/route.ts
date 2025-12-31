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

    // Check user verification status before allowing dispute intent
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerified: true,
        phoneVerified: true,
        email: true,
        phone: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Require email and phone verification to open disputes
    if (!user.emailVerified) {
      return NextResponse.json(
        { 
          error: 'Email verification required',
          message: 'You must verify your email address before opening a dispute. Please verify your email in Settings.',
        },
        { status: 403 }
      )
    }

    if (!user.phoneVerified) {
      return NextResponse.json(
        { 
          error: 'Phone verification required',
          message: 'You must verify your phone number before opening a dispute. Please verify your phone in Settings.',
        },
        { status: 403 }
      )
    }

    // Get rift and verify user is buyer or seller
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        itemType: true,
        status: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    const isBuyer = rift.buyerId === userId
    const isSeller = rift.sellerId === userId

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if rift is in a state that allows disputes
    const allowedStatuses = [
      'FUNDED', 
      'PROOF_SUBMITTED', 
      'UNDER_REVIEW', 
      'DELIVERED_PENDING_RELEASE', 
      'IN_PROGRESS',
      'IN_TRANSIT',
      'AWAITING_SHIPMENT',
    ]
    
    if (!allowedStatuses.includes(rift.status)) {
      return NextResponse.json(
        { error: `Cannot open dispute in current status: ${rift.status}. Disputes can only be opened for active transactions after payment has been made.` },
        { status: 400 }
      )
    }

    // Log intent event
    const requestMeta = extractRequestMetadata(request)
    const actorType = isBuyer ? RiftEventActorType.BUYER : RiftEventActorType.SELLER
    await logEvent(
      riftId,
      actorType,
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

