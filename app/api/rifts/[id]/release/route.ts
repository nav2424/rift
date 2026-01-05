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

    // For manual releases (buyer action), allow early release if status indicates proof was submitted
    // PROOF_SUBMITTED or UNDER_REVIEW status means proof exists - no need to query
    // Buyers can release funds early without waiting for admin approval
    
    // If status is PROOF_SUBMITTED or UNDER_REVIEW, proof was submitted, so allow release
    if (rift.status !== 'PROOF_SUBMITTED' && rift.status !== 'UNDER_REVIEW' && rift.status !== 'DELIVERED_PENDING_RELEASE') {
      // For other statuses, check if proof exists (legacy support)
      const hasProof = await prisma.proof.findFirst({
        where: {
          riftId: rift.id,
        },
      })

      if (!hasProof) {
        return NextResponse.json(
          { 
            error: 'Cannot release funds: Seller has not submitted proof yet.',
          },
          { status: 400 }
        )
      }
    }
    
    // For manual early releases, buyer can release as soon as proof is submitted (no need to wait for admin approval)

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
