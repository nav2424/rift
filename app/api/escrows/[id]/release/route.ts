import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { transitionRiftState } from '@/lib/rift-state'
import { canBuyerRelease } from '@/lib/state-machine'

/**
 * Release funds (buyer action)
 * Transitions rift to RELEASED state, which credits seller wallet
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
      return NextResponse.json({ error: 'Only buyer can release funds' }, { status: 403 })
    }

    // Verify state
    if (!canBuyerRelease(rift.status)) {
      return NextResponse.json(
        { error: `Cannot release funds in ${rift.status} state` },
        { status: 400 }
      )
    }

    // Check for open disputes
    const openDisputes = await prisma.dispute.count({
      where: {
        escrowId: rift.id,
        status: 'OPEN',
      },
    })

    if (openDisputes > 0) {
      return NextResponse.json(
        { error: 'Cannot release funds while dispute is open' },
        { status: 400 }
      )
    }

    // Transition to RELEASED (handles wallet credit and payout scheduling)
    await transitionRiftState(rift.id, 'RELEASED', { userId: auth.userId })

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: rift.id,
        type: 'FUNDS_RELEASED',
        message: `Buyer released funds. Seller receives ${rift.currency} ${rift.sellerNet?.toFixed(2) || '0.00'} (${rift.currency} ${rift.sellerFee.toFixed(2)} platform fee deducted)`,
        createdById: auth.userId,
      },
    })

    return NextResponse.json({
      success: true,
      status: 'RELEASED',
      sellerNet: rift.sellerNet,
    })
  } catch (error: any) {
    console.error('Release funds error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
