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
    const escrow = await prisma.escrowTransaction.findUnique({
      where: { id },
      include: {
        buyer: true,
        seller: true,
      },
    })

    if (!escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    const userRole = getUserRole(
      auth.userId,
      escrow.buyerId,
      escrow.sellerId,
      auth.userRole
    )

    // Only buyer can cancel
    if (userRole !== 'BUYER') {
      return NextResponse.json({ error: 'Only buyer can cancel' }, { status: 403 })
    }

    // Allow cancellation from AWAITING_PAYMENT or AWAITING_SHIPMENT
    if (!['AWAITING_PAYMENT', 'AWAITING_SHIPMENT'].includes(escrow.status)) {
      return NextResponse.json(
        { error: 'Cannot cancel in current status' },
        { status: 400 }
      )
    }

    // Use CANCELED for AWAITING_PAYMENT (new state machine) or CANCELLED for legacy
    const canceledStatus: EscrowStatus = escrow.status === 'AWAITING_PAYMENT' ? 'CANCELED' : 'CANCELLED'
    
    if (!canTransition(escrow.status, canceledStatus, userRole)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      )
    }

    // Store old status before updating (needed for rollback)
    const oldStatus = escrow.status

    // Rollback balance if payment was already made (AWAITING_SHIPMENT means payment was received)
    // Do this BEFORE updating status, as rollbackBalance checks the current status
    if (oldStatus === 'AWAITING_SHIPMENT') {
      try {
        // Temporarily restore status for rollback, then update to cancelled
        // rollbackBalance checks status, so we need to pass it or check before
        await prisma.user.update({
          where: { id: escrow.sellerId },
          data: {
            availableBalance: {
              decrement: escrow.amount ?? 0,
            },
            pendingBalance: {
              decrement: escrow.amount ?? 0,
            },
          },
        })
      } catch (error) {
        console.error('Error rolling back balance:', error)
        // Continue with cancellation even if rollback fails
      }
    }

    // Update escrow status
    await prisma.escrowTransaction.update({
      where: { id },
      data: { status: canceledStatus },
    })

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: id,
        type: 'ESCROW_CANCELLED',
        message: 'Escrow cancelled by buyer',
        createdById: auth.userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel escrow error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

