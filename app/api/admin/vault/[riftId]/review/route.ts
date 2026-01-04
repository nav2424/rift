/**
 * Admin Review Actions
 * Approve, reject, or escalate proofs
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { transitionRiftState } from '@/lib/rift-state'
import { logVaultEvent } from '@/lib/vault-logging'

/**
 * POST /api/admin/vault/[riftId]/review
 * Create or update admin review
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ riftId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { riftId } = await params
    const body = await request.json()
    const { action, reasons, notes } = body

    if (!['APPROVE', 'REJECT', 'ESCALATE'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Create or update admin review
    const reviewStatus =
      action === 'APPROVE'
        ? 'APPROVED'
        : action === 'REJECT'
          ? 'REJECTED'
          : 'ESCALATED'

    // Check if review already exists
    const existingReview = await prisma.admin_reviews.findFirst({
      where: { riftId },
    })

    const review = existingReview
      ? await prisma.admin_reviews.update({
          where: { id: existingReview.id },
          data: {
            reviewerId: session.user.id,
            status: reviewStatus,
            reasonsJson: reasons || null,
            notes: notes || null,
            resolvedAt: action === 'APPROVE' || action === 'REJECT' ? new Date() : null,
          },
        })
      : await prisma.admin_reviews.create({
          data: {
            id: crypto.randomUUID(),
            riftId,
            reviewerId: session.user.id,
            status: reviewStatus,
            reasonsJson: reasons || null,
            notes: notes || null,
            resolvedAt: action === 'APPROVE' || action === 'REJECT' ? new Date() : null,
          },
        })

    // Log admin action
    await logVaultEvent({
      riftId,
      actorId: session.user.id,
      actorRole: 'ADMIN',
      eventType:
        action === 'APPROVE'
          ? 'ADMIN_APPROVED_PROOF'
          : action === 'REJECT'
            ? 'ADMIN_REJECTED_PROOF'
            : 'ADMIN_VIEWED_ASSET', // Use ADMIN_VIEWED_ASSET for escalation
      metadata: {
        reviewId: review.id,
        reasons,
        notes,
      },
    })

    // Handle state transitions
    if (action === 'APPROVE') {
      // Approve → RELEASED
      if (rift.status === 'UNDER_REVIEW' || rift.status === 'PROOF_SUBMITTED') {
        await transitionRiftState(riftId, 'RELEASED', {
          userId: session.user.id,
          reason: 'Admin approved proof',
        })
      }
    } else if (action === 'REJECT') {
      // Reject → back to PROOF_SUBMITTED (request resubmission)
      if (rift.status === 'UNDER_REVIEW') {
        await transitionRiftState(riftId, 'PROOF_SUBMITTED', {
          userId: session.user.id,
          reason: 'Admin rejected proof - resubmission required',
        })
      }
    } else if (action === 'ESCALATE') {
      // Escalate → DISPUTED (fraud suspected)
      if (rift.status === 'UNDER_REVIEW' || rift.status === 'PROOF_SUBMITTED') {
        await transitionRiftState(riftId, 'DISPUTED', {
          userId: session.user.id,
          reason: 'Admin escalated - fraud suspected',
        })
      }
    }

    return NextResponse.json({
      success: true,
      review,
      newStatus: (await prisma.riftTransaction.findUnique({ where: { id: riftId } }))?.status,
    })
  } catch (error: any) {
    console.error('Admin review error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process review' },
      { status: 500 }
    )
  }
}

