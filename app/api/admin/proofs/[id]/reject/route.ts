import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Admin endpoint to reject a proof
 * Sets proof status to REJECTED and keeps rift in UNDER_REVIEW
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
    const body = await request.json()
    const { rejectionReason, adminNotes } = body

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

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
        { error: `Proof is already ${proof.status}. Only PENDING proofs can be rejected.` },
        { status: 400 }
      )
    }

    // Update proof to REJECTED
    await prisma.proof.update({
      where: { id },
      data: {
        status: 'REJECTED',
        validatedAt: new Date(),
        validatedBy: session.user.id,
        rejectionReason: rejectionReason.trim(),
      },
    })

    // Rift stays in UNDER_REVIEW - seller can resubmit proof
    // Status remains UNDER_REVIEW so seller can submit a new proof
    // The canSellerSubmitProof function allows submission when status is UNDER_REVIEW

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        id: crypto.randomUUID(),
        escrowId: proof.riftId,
        type: 'PROOF_REJECTED',
        message: `Proof rejected by admin. Reason: ${rejectionReason}${adminNotes ? `. Admin note: ${adminNotes}` : ''}`,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      proofId: id,
      status: 'REJECTED',
      message: 'Proof rejected successfully',
    })
  } catch (error: any) {
    console.error('Reject proof error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
