import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { transitionRiftState } from '@/lib/rift-state'
import { canBuyerRelease } from '@/lib/state-machine'
import { computeReleaseEligibility, releaseFunds } from '@/lib/release-engine'
import { extractRequestMetadata } from '@/lib/rift-events'

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
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Verify buyer
    if (rift.buyerId !== auth.userId) {
      return NextResponse.json({ error: 'Only buyer can release funds' }, { status: 403 })
    }

    // Check eligibility using release engine
    const eligibility = await computeReleaseEligibility(rift.id)
    
    if (!eligibility.eligible) {
      return NextResponse.json(
        { 
          error: eligibility.reason || 'Not eligible for release',
          details: eligibility.details,
        },
        { status: 400 }
      )
    }

    // For legacy compatibility, also check state machine rules
    if (!canBuyerRelease(rift.status)) {
      return NextResponse.json(
        { error: `Cannot release funds in ${rift.status} state` },
        { status: 400 }
      )
    }

    // Create timeline event for buyer releasing funds
    try {
      await prisma.timelineEvent.create({
        data: {
          escrowId: rift.id,
          type: 'BUYER_RELEASED',
          message: 'Buyer released funds',
          createdById: auth.userId,
        },
      })
      console.log(`✅ Created BUYER_RELEASED timeline event for rift ${rift.id}`)
    } catch (error: any) {
      console.error('Error creating BUYER_RELEASED timeline event:', error)
      // Don't fail the release if timeline event creation fails
    }

    // Use release engine to release funds (includes eligibility check and event logging)
    const requestMeta = extractRequestMetadata(request)
    const releaseResult = await releaseFunds(rift.id, requestMeta)

    if (!releaseResult.success) {
      return NextResponse.json(
        { error: releaseResult.error || 'Failed to release funds' },
        { status: 500 }
      )
    }

    // Transition to RELEASED (handles wallet credit, payout scheduling)
    // Note: releaseFunds already updates status to RELEASED, but transitionRiftState
    // handles wallet operations, so we still need to call it
    await transitionRiftState(rift.id, 'RELEASED', { userId: auth.userId })

    return NextResponse.json({
      success: true,
      status: 'RELEASED',
      sellerNet: rift.sellerNet,
      details: releaseResult.details,
    })
  } catch (error: any) {
    console.error('Release funds error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
