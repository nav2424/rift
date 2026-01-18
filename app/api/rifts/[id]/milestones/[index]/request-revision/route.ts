import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import {
  normalizeMilestones,
  getNextUnreleasedMilestoneIndex,
  getMilestoneRevisionLimit,
  getMilestoneReviewWindowDays,
  calculateMilestoneAutoReleaseAt,
  getLatestReleasedAt,
} from '@/lib/milestone-utils'
import { RiftEventActorType } from '@prisma/client'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, index } = await params
    const milestoneIndex = parseInt(index, 10)
    if (Number.isNaN(milestoneIndex)) {
      return NextResponse.json({ error: 'Invalid milestone index' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      include: {
        MilestoneRelease: {
          where: { status: 'RELEASED' },
          orderBy: { releasedAt: 'desc' },
        },
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    if (rift.buyerId !== auth.userId) {
      return NextResponse.json({ error: 'Only buyer can request revisions' }, { status: 403 })
    }

    if (rift.itemType !== 'SERVICES' || !rift.allowsPartialRelease) {
      return NextResponse.json({ error: 'This rift does not support milestone revisions' }, { status: 400 })
    }

    if (!['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(rift.status)) {
      return NextResponse.json(
        { error: 'Revisions can only be requested during the review window' },
        { status: 400 }
      )
    }

    const milestones = normalizeMilestones(rift.milestones)
    if (!milestones || milestones.length === 0) {
      return NextResponse.json({ error: 'No milestones found for this rift' }, { status: 400 })
    }

    const nextIndex = getNextUnreleasedMilestoneIndex(milestones, rift.MilestoneRelease)
    if (nextIndex === null || nextIndex !== milestoneIndex) {
      return NextResponse.json(
        { error: 'Revisions can only be requested for the active milestone' },
        { status: 400 }
      )
    }

    const reviewWindowDays = getMilestoneReviewWindowDays(milestones[milestoneIndex])
    const deadline = rift.autoReleaseAt
      ? new Date(rift.autoReleaseAt)
      : rift.proofSubmittedAt
        ? calculateMilestoneAutoReleaseAt(rift.proofSubmittedAt, reviewWindowDays)
        : null

    if (!deadline || new Date() > deadline) {
      return NextResponse.json(
        { error: 'Review window has expired. Revisions must be requested before the deadline.' },
        { status: 400 }
      )
    }

    const revisionLimit = getMilestoneRevisionLimit(milestones[milestoneIndex])
    const lastReleaseAt = getLatestReleasedAt(rift.MilestoneRelease) || new Date(0)
    const revisionEvents = await prisma.rift_events.findMany({
      where: {
        riftId: id,
        eventType: 'MILESTONE_REVISION_REQUESTED',
        createdAt: { gt: lastReleaseAt },
      },
      select: { payload: true },
    })
    const revisionRequests = revisionEvents.filter((event) => {
      const indexFromPayload = (event.payload as any)?.milestoneIndex
      return indexFromPayload === milestoneIndex
    }).length

    if (revisionRequests >= revisionLimit) {
      return NextResponse.json(
        { error: 'Revision limit reached for this milestone' },
        { status: 400 }
      )
    }

    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      id,
      RiftEventActorType.BUYER,
      auth.userId,
      'MILESTONE_REVISION_REQUESTED',
      {
        milestoneIndex,
        reason: reason || null,
        reviewWindowDays,
      },
      requestMeta
    )

    await prisma.timelineEvent.create({
      data: {
        id: crypto.randomUUID(),
        escrowId: id,
        type: 'MILESTONE_REVISION_REQUESTED',
        message: `Revision requested for milestone "${milestones[milestoneIndex].title}".${reason ? ` Reason: ${reason}` : ''}`,
        createdById: auth.userId,
      },
    })

    await prisma.riftTransaction.update({
      where: { id },
      data: {
        autoReleaseScheduled: false,
        autoReleaseAt: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Request revision error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to request revision' },
      { status: 500 }
    )
  }
}
