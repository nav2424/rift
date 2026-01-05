import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { transitionRiftState } from '@/lib/rift-state'
import { canBuyerRelease } from '@/lib/state-machine'
import { extractRequestMetadata, logEvent } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'

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
      include: {
        MilestoneRelease: {
          where: { status: 'RELEASED' },
        },
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Verify buyer
    if (rift.buyerId !== auth.userId) {
      return NextResponse.json({ error: 'Only buyer can release funds' }, { status: 403 })
    }

    // For service rifts with milestone-based releases, prevent full release
    // Buyers must release milestones individually
    if (rift.itemType === 'SERVICES' && rift.allowsPartialRelease) {
      const milestones = (rift.milestones as Array<{ amount: number }>) || []
      const releasedCount = rift.MilestoneRelease.length
      
      if (releasedCount < milestones.length) {
        return NextResponse.json(
          {
            error: 'This rift uses milestone-based payments. Please release funds per milestone using the milestone interface.',
            requiresMilestoneRelease: true,
            totalMilestones: milestones.length,
            releasedMilestones: releasedCount,
          },
          { status: 400 }
        )
      }
      
      // If all milestones are released, the rift should already be RELEASED
      // This should not happen, but handle it gracefully
      if (rift.status === 'RELEASED') {
        return NextResponse.json(
          { error: 'All milestones have already been released' },
          { status: 400 }
        )
      }
    }

    // For manual releases (buyer action), allow early release without any proof requirement
    // Buyers can release funds early at any time - no proof needed
    // If status is PROOF_SUBMITTED or UNDER_REVIEW, that means proof was submitted, so release is allowed
    // But even without proof, buyers should be able to release funds early if they want

    // For legacy compatibility, also check state machine rules
    if (!canBuyerRelease(rift.status)) {
      return NextResponse.json(
        { error: `Cannot release funds in ${rift.status} state` },
        { status: 400 }
      )
    }

    // For manual releases, directly transition to RELEASED without eligibility checks
    // Buyers can release funds early at any time
    
    // Transition to RELEASED (handles wallet credit, payout scheduling, status update)
    await transitionRiftState(rift.id, 'RELEASED', { userId: auth.userId })

    // Create timeline event for buyer releasing funds
    try {
      await prisma.timelineEvent.create({
        data: {
          id: crypto.randomUUID(),
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

    // Log RELEASE_ELIGIBLE event if not already logged (for tracking)
    try {
      const existingEvent = await prisma.rift_events.findFirst({
        where: {
          riftId: rift.id,
          eventType: 'RELEASE_ELIGIBLE',
        },
      })

      if (!existingEvent) {
        const requestMeta = extractRequestMetadata(request)
        await logEvent(
          rift.id,
          RiftEventActorType.SYSTEM,
          null,
          'RELEASE_ELIGIBLE',
          {
            reason: 'Buyer manually released funds early',
            category: rift.itemType,
          },
          requestMeta
        )
      }
    } catch (error: any) {
      console.error('Error logging RELEASE_ELIGIBLE event:', error)
      // Don't fail the release if event logging fails
    }

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
