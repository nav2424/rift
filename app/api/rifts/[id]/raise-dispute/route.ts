import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { canTransition, getUserRole } from '@/lib/rules'
import { sendDisputeRaisedEmail } from '@/lib/email'

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
    const body = await request.json()
    const { reason, type } = body

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'Dispute reason is required' },
        { status: 400 }
      )
    }

    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    const userRole = getUserRole(
      auth.userId,
      rift.buyerId,
      rift.sellerId,
      auth.userRole
    )

    // Only buyer can raise disputes
    if (userRole !== 'BUYER') {
      return NextResponse.json({ error: 'Only buyer can raise disputes' }, { status: 403 })
    }

    // Hybrid protection only applies to PHYSICAL items
    const isPhysical = rift.itemType === 'PHYSICAL'
    const shipmentVerified = isPhysical && rift.shipmentVerifiedAt !== null && rift.trackingVerified
    const deliveryVerified = rift.deliveryVerifiedAt !== null

    // Determine dispute type if not provided
    let disputeType = type || 'ITEM_NOT_RECEIVED'

    // For PHYSICAL items: If shipment is verified and delivered, restrict dispute types
    // For non-physical items: Always allow all dispute types (no hybrid protection)
    if (isPhysical && shipmentVerified && deliveryVerified) {
      // After verified delivery, buyer can only dispute:
      // - Item not as described
      // - Item damaged
      // - Wrong item
      // - Wrong address (with proof)
      // NOT: Item not received (they can't claim they didn't receive if verified)
      
      if (disputeType === 'ITEM_NOT_RECEIVED') {
        return NextResponse.json(
          { 
            error: 'Cannot dispute "item not received" after verified delivery. You can dispute: item not as described, damaged, wrong item, or wrong address.',
            allowedTypes: ['ITEM_NOT_AS_DESCRIBED', 'ITEM_DAMAGED', 'WRONG_ITEM', 'WRONG_ADDRESS', 'OTHER']
          },
          { status: 400 }
        )
      }

      // Allowed dispute types after verified delivery
      const allowedTypes = ['ITEM_NOT_AS_DESCRIBED', 'ITEM_DAMAGED', 'WRONG_ITEM', 'WRONG_ADDRESS', 'OTHER']
      if (!allowedTypes.includes(disputeType)) {
        disputeType = 'OTHER'
      }
    } else {
      // Before verified delivery, buyer can dispute anything
      if (!['ITEM_NOT_RECEIVED', 'ITEM_NOT_AS_DESCRIBED', 'ITEM_DAMAGED', 'WRONG_ITEM', 'WRONG_ADDRESS', 'OTHER'].includes(disputeType)) {
        disputeType = 'ITEM_NOT_RECEIVED'
      }
    }

    if (!['IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'].includes(rift.status)) {
      return NextResponse.json(
        { error: 'Cannot raise dispute in current status' },
        { status: 400 }
      )
    }

    // Cancel auto-release if scheduled
    if (rift.autoReleaseScheduled) {
      await prisma.riftTransaction.update({
        where: { id },
        data: { autoReleaseScheduled: false },
      })
    }

    if (!canTransition(rift.status, 'DISPUTED', userRole)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      )
    }

    // Create dispute with type
    await prisma.dispute.create({
      data: {
        escrowId: id,
        raisedById: auth.userId,
        reason: reason.trim(),
        type: disputeType,
        status: 'OPEN',
      },
    })

    // Update rift status
    await prisma.riftTransaction.update({
      where: { id },
      data: { status: 'DISPUTED' },
    })

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: id,
        type: 'DISPUTE_RAISED',
        message: `Dispute raised: ${reason.substring(0, 100)}${reason.length > 100 ? '...' : ''}`,
        createdById: auth.userId,
      },
    })

    // Get dispute details for email
    const dispute = await prisma.dispute.findFirst({
      where: { escrowId: id },
      orderBy: { createdAt: 'desc' },
    })

    // Send email notifications with comprehensive details
    const escrowWithUsers = await prisma.riftTransaction.findUnique({
      where: { id },
      include: {
        buyer: true,
        seller: true,
      },
    })

    // Get admin email
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    })

    if (escrowWithUsers && admin) {
      await sendDisputeRaisedEmail(
        escrowWithUsers.buyer.email,
        escrowWithUsers.seller.email,
        admin.email,
        id,
        escrowWithUsers.itemTitle,
        reason,
        {
          disputeType: disputeType,
          disputeId: dispute?.id,
          riftNumber: escrowWithUsers.riftNumber,
          subtotal: escrowWithUsers.subtotal,
          currency: escrowWithUsers.currency,
          itemDescription: escrowWithUsers.itemDescription,
          itemType: escrowWithUsers.itemType,
          shippingAddress: escrowWithUsers.shippingAddress,
          buyerName: escrowWithUsers.buyer.name,
          sellerName: escrowWithUsers.seller.name,
          buyerEmail: escrowWithUsers.buyer.email,
          sellerEmail: escrowWithUsers.seller.email,
          createdAt: dispute?.createdAt || new Date(),
        }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Raise dispute error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

