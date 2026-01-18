import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { transitionRiftState } from '@/lib/rift-state'
import { calculateAutoReleaseDeadline } from '@/lib/rift-state'
import {
  normalizeMilestones,
  getNextUnreleasedMilestoneIndex,
  getMilestoneReviewWindowDays,
  calculateMilestoneAutoReleaseAt,
} from '@/lib/milestone-utils'

/**
 * Admin endpoint to approve a proof
 * Sets proof status to VALID and transitions rift to PROOF_SUBMITTED
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { adminNotes } = body

    // Get proof with rift details
    const proof = await prisma.proof.findUnique({
      where: { id },
      include: {
        RiftTransaction: true,
      },
    })

    if (!proof) {
      return NextResponse.json({ error: 'Proof not found' }, { status: 404 })
    }

    if (proof.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Proof is already ${proof.status}. Only PENDING proofs can be approved.` },
        { status: 400 }
      )
    }

    // Double-check status after fetching to prevent race conditions
    // Use a transaction to ensure atomicity
    const updatedProof = await prisma.proof.updateMany({
      where: {
        id,
        status: 'PENDING', // Only update if still PENDING
      },
      data: {
        status: 'VALID',
        validatedAt: new Date(),
        validatedBy: session.user.id,
        rejectionReason: null,
      },
    })

    // If no rows were updated, proof was already approved by another request
    if (updatedProof.count === 0) {
      return NextResponse.json(
        { error: 'Proof was already approved. Please refresh the page.' },
        { status: 400 }
      )
    }

    // Proof status is updated above in the updateMany call
    // This ensures we don't update if it was already approved

    // Refresh rift data to get latest status
    const updatedRift = await prisma.riftTransaction.findUnique({
      where: { id: proof.riftId },
    })

    if (!updatedRift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Transition rift to PROOF_SUBMITTED if it's in UNDER_REVIEW
    // This allows the buyer to release funds after admin approval
    if (updatedRift.status === 'UNDER_REVIEW') {
      try {
        await transitionRiftState(proof.riftId, 'PROOF_SUBMITTED', { userId: session.user.id })
        console.log(`✅ Transitioned rift ${proof.riftId} from UNDER_REVIEW to PROOF_SUBMITTED`)
      } catch (transitionError: any) {
        console.error('State transition error:', transitionError)
        // If transition fails, log but continue - proof is still approved
        // We'll still create the timeline event
      }
    }

    // Calculate auto-release deadline
    let autoReleaseAt = calculateAutoReleaseDeadline(
      updatedRift.itemType,
      new Date(),
      updatedRift.fundedAt
    )

    if (updatedRift.itemType === 'SERVICES' && updatedRift.allowsPartialRelease && updatedRift.milestones) {
      const milestones = normalizeMilestones(updatedRift.milestones)
      const releases = await prisma.milestoneRelease.findMany({
        where: { riftId: updatedRift.id, status: 'RELEASED' },
        select: { milestoneIndex: true, status: true },
      })
      const nextIndex = getNextUnreleasedMilestoneIndex(milestones, releases)
      if (nextIndex !== null) {
        const reviewWindowDays = getMilestoneReviewWindowDays(milestones[nextIndex])
        autoReleaseAt = calculateMilestoneAutoReleaseAt(new Date(), reviewWindowDays)
      }
    }

    // Update auto-release deadline
    if (autoReleaseAt) {
      await prisma.riftTransaction.update({
        where: { id: proof.riftId },
        data: {
          autoReleaseAt,
          autoReleaseScheduled: true,
        },
      })
    }

    // Create timeline event - check for duplicates within last 5 seconds to prevent rapid clicks
    const fiveSecondsAgo = new Date(Date.now() - 5 * 1000)
    const existingEvent = await prisma.timelineEvent.findFirst({
      where: {
        escrowId: proof.riftId,
        type: 'PROOF_APPROVED',
        createdAt: {
          gte: fiveSecondsAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Only create if no recent event exists (within 5 seconds)
    if (!existingEvent) {
      try {
        await prisma.timelineEvent.create({
          data: {
            id: crypto.randomUUID(),
            escrowId: proof.riftId,
            type: 'PROOF_APPROVED',
            message: `Proof approved by admin${adminNotes ? `. Note: ${adminNotes}` : ''}`,
            createdById: session.user.id,
          },
        })
        console.log(`✅ Created timeline event for proof approval on rift ${proof.riftId}`)
      } catch (timelineError: any) {
        console.error('Timeline event creation error:', timelineError)
        // Log but don't fail the request - event might already exist
      }
    } else {
      console.log(`⚠️ Timeline event already exists for proof approval on rift ${proof.riftId} (within last 5 seconds)`)
    }

    return NextResponse.json({
      success: true,
      proofId: id,
      status: 'VALID',
      message: 'Proof approved successfully',
    })
  } catch (error: any) {
    console.error('Approve proof error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
