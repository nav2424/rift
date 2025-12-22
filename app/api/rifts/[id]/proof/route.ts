import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { validateProof, getProofTypeFromItemType } from '@/lib/proof-validation'
import { transitionRiftState } from '@/lib/rift-state'
import { calculateAutoReleaseDeadline } from '@/lib/rift-state'
import { canSellerSubmitProof } from '@/lib/state-machine'
import { sendProofSubmittedEmail } from '@/lib/email'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomBytes } from 'crypto'

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
    const rift = await prisma.riftTransaction.findUnique({
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

    // Handle both FormData and JSON requests
    let proofPayload: any = {}
    let uploadedFiles: string[] = []
    
    // Check content-type to determine if it's FormData or JSON
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (file uploads)
      const formData = await request.formData()
      const notes = formData.get('notes') as string | null
      const files = formData.getAll('files') as File[]
      
      proofPayload = {
        notes: notes || undefined,
      }
      
      // Save uploaded files
      const uploadsDir = join(process.cwd(), 'public', 'uploads')
      try {
        await mkdir(uploadsDir, { recursive: true })
      } catch (error) {
        // Directory might already exist
      }
      
      for (const file of files) {
        if (file && file.size > 0) {
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)
          
          const fileExtension = file.name.split('.').pop() || 'bin'
          const uniqueName = `${randomBytes(16).toString('hex')}.${fileExtension}`
          const filePath = `/uploads/${uniqueName}`
          
          await writeFile(join(uploadsDir, uniqueName), buffer)
          uploadedFiles.push(filePath)
        }
      }
    } else {
      // Handle JSON request
      const body = await request.json()
      proofPayload = body.proofPayload || {}
      uploadedFiles = body.uploadedFiles || []
    }
    

    if (!proofPayload) {
      return NextResponse.json(
        { error: 'Proof payload is required' },
        { status: 400 }
      )
    }

    // Get proof type from item type
    const proofType = getProofTypeFromItemType(rift.itemType)

    // All proofs require manual admin approval - always set to PENDING
    // Create proof record with PENDING status (awaiting admin review)
    const proof = await prisma.proof.create({
      data: {
        riftId: rift.id,
        proofType,
        proofPayload: proofPayload as any,
        uploadedFiles: uploadedFiles || [],
        status: 'PENDING', // Always PENDING until admin approves/rejects
        submittedAt: new Date(),
        validatedAt: null, // Will be set when admin validates
      },
    })

    // Transition state: FUNDED -> PROOF_SUBMITTED -> UNDER_REVIEW
    // All proofs require manual review, so we transition to UNDER_REVIEW
    if (rift.status === 'FUNDED') {
      // First transition to PROOF_SUBMITTED (required by state machine)
      await transitionRiftState(rift.id, 'PROOF_SUBMITTED', { userId: auth.userId })
      // Then immediately transition to UNDER_REVIEW (for admin review)
      await transitionRiftState(rift.id, 'UNDER_REVIEW', { userId: auth.userId })
    } else if (rift.status === 'UNDER_REVIEW') {
      // Already in UNDER_REVIEW (resubmission after rejection), no transition needed
      // Just create the new proof record (already done above)
    }

    // Note: Auto-release deadline will be set when proof is approved by admin
    // Don't set it here since proof is pending review

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: rift.id,
        type: 'PROOF_SUBMITTED',
        message: 'Proof submitted - awaiting admin review',
        createdById: auth.userId,
      },
    })

    // Send email notification to all admins
    const escrowWithSeller = await prisma.riftTransaction.findUnique({
      where: { id: rift.id },
      include: {
        seller: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // Get all admin emails
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        email: true,
      },
    })

    if (escrowWithSeller && admins.length > 0) {
      // Notify all admins
      await Promise.all(
        admins.map(admin =>
          sendProofSubmittedEmail(
            admin.email,
            rift.id,
            rift.itemTitle,
            escrowWithSeller.seller.name,
            escrowWithSeller.seller.email,
            proofType,
            rift.riftNumber
          )
        )
      )
    }

    return NextResponse.json({
      success: true,
      proofId: proof.id,
      status: 'UNDER_REVIEW',
      message: 'Proof submitted successfully. It will be reviewed by our team shortly.',
    })
  } catch (error: any) {
    console.error('Submit proof error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
