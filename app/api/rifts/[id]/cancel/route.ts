import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { canTransition, getUserRole } from '@/lib/rules'
import { rollbackBalance } from '@/lib/balance'
import { EscrowStatus } from '@prisma/client'

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
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      include: {
        buyer: true,
        seller: true,
      },
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

    // Only buyer can cancel
    if (userRole !== 'BUYER') {
      return NextResponse.json({ error: 'Only buyer can cancel' }, { status: 403 })
    }

    // Allow cancellation from DRAFT, AWAITING_PAYMENT, or FUNDED (new system)
    // Also support legacy AWAITING_SHIPMENT
    const canCancel = ['DRAFT', 'AWAITING_PAYMENT', 'FUNDED', 'AWAITING_SHIPMENT'].includes(rift.status)
    
    if (!canCancel) {
      return NextResponse.json(
        { error: 'Cannot cancel in current status. Rift must be in DRAFT, AWAITING_PAYMENT, or FUNDED status.' },
        { status: 400 }
      )
    }

    // Use CANCELED for new system (DRAFT, FUNDED) or legacy (AWAITING_PAYMENT, AWAITING_SHIPMENT)
    const canceledStatus: EscrowStatus = 
      ['DRAFT', 'FUNDED', 'AWAITING_PAYMENT'].includes(rift.status) ? 'CANCELED' : 'CANCELLED'
    
    if (!canTransition(rift.status, canceledStatus, userRole)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      )
    }

    // Store old status before updating (needed for rollback)
    const oldStatus = rift.status

    // Rollback balance if payment was already made (FUNDED or AWAITING_SHIPMENT means payment was received)
    // Do this BEFORE updating status, as rollbackBalance checks the current status
    if (oldStatus === 'FUNDED' || oldStatus === 'AWAITING_SHIPMENT') {
      try {
        // Rollback balance using subtotal
        await prisma.user.update({
          where: { id: rift.sellerId },
          data: {
            availableBalance: {
              decrement: rift.subtotal,
            },
            pendingBalance: {
              decrement: rift.subtotal,
            },
          },
        })
      } catch (error) {
        console.error('Error rolling back balance:', error)
        // Continue with cancellation even if rollback fails
      }
    }

    // Update rift status
    await prisma.riftTransaction.update({
      where: { id },
      data: { status: canceledStatus },
    })

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: id,
        type: 'RIFT_CANCELLED',
        message: 'Rift cancelled by buyer',
        createdById: auth.userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel rift error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

