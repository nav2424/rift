import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { validateProof, getProofTypeFromItemType } from '@/lib/proof-validation'
import { transitionRiftState } from '@/lib/rift-state'
import { calculateAutoReleaseDeadline } from '@/lib/rift-state'
import { canSellerSubmitProof } from '@/lib/state-machine'

/**
 * Submit proof of delivery
 * Seller submits proof, which is validated and rift transitions to PROOF_SUBMITTED
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

    // Verify seller
    if (rift.sellerId !== auth.userId) {
      return NextResponse.json({ error: 'Only seller can submit proof' }, { status: 403 })
    }

    // Verify state
    if (!canSellerSubmitProof(rift.status)) {
      return NextResponse.json(
        { error: `Cannot submit proof in ${rift.status} state` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { proofPayload, uploadedFiles } = body

    if (!proofPayload) {
      return NextResponse.json(
        { error: 'Proof payload is required' },
        { status: 400 }
      )
    }

    // Get proof type from item type
    const proofType = getProofTypeFromItemType(rift.itemType)

    // Validate proof
    const validation = validateProof(proofType, proofPayload)

    // Create proof record
    const proof = await prisma.proof.create({
      data: {
        riftId: rift.id,
        proofType,
        proofPayload: proofPayload as any,
        uploadedFiles: uploadedFiles || [],
        status: validation.status,
        submittedAt: new Date(),
        validatedAt: validation.isValid ? new Date() : null,
      },
    })

    // Calculate auto-release deadline
    const autoReleaseAt = calculateAutoReleaseDeadline(
      rift.itemType,
      new Date(),
      rift.fundedAt
    )

    // Transition to PROOF_SUBMITTED or UNDER_REVIEW based on validation
    const nextStatus = validation.isValid ? 'PROOF_SUBMITTED' : 'UNDER_REVIEW'
    await transitionRiftState(rift.id, nextStatus, { userId: auth.userId })

    // Update auto-release deadline
    if (autoReleaseAt) {
      await prisma.escrowTransaction.update({
        where: { id: rift.id },
        data: {
          autoReleaseAt,
          autoReleaseScheduled: true,
        },
      })
    }

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: rift.id,
        type: 'PROOF_SUBMITTED',
        message: `Proof submitted${validation.isValid ? ' and validated' : ' - under review'}`,
        createdById: auth.userId,
      },
    })

    return NextResponse.json({
      success: true,
      proofId: proof.id,
      status: nextStatus,
      autoReleaseAt,
      validation: {
        isValid: validation.isValid,
        status: validation.status,
        rejectionReason: validation.rejectionReason,
      },
    })
  } catch (error: any) {
    console.error('Submit proof error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
