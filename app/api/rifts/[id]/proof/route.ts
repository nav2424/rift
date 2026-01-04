import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { validateProof, getProofTypeFromItemType } from '@/lib/proof-validation'
import { transitionRiftState } from '@/lib/rift-state'
import { calculateAutoReleaseDeadline } from '@/lib/rift-state'
import { canSellerSubmitProof } from '@/lib/state-machine'
import { sendProofSubmittedEmail } from '@/lib/email'
import { uploadVaultAsset } from '@/lib/vault-enhanced'
import { VaultAssetType } from '@prisma/client'
import { validateProofTypeLock } from '@/lib/proof-type-validation'
import { checkDuplicateProofs } from '@/lib/duplicate-proof-detection'
import { isProofDeadlinePassed, calculateProofDeadline, getHoursUntilProofDeadline } from '@/lib/proof-deadlines'
import { logVaultEvent } from '@/lib/vault-logging'
import { checkProofRateLimit } from '@/lib/rate-limits-proof'
import { createServerClient } from '@/lib/supabase'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'

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

    // Rate limit: Proof submissions (10/hour)
    // Set userId in request for rate limiter
    ;(request as any).userId = auth.userId
    const rateLimitResult = checkProofRateLimit(request as any, 'submission')
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: rateLimitResult.error || 'Too many proof submissions. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
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

    // Check proof deadline (CRITICAL: Enforce deadline at submission time)
    if (rift.fundedAt) {
      if (isProofDeadlinePassed(rift.itemType as any, rift.fundedAt, rift.proofSubmittedAt, rift.serviceDate ? new Date(rift.serviceDate) : null)) {
        return NextResponse.json(
          { 
            error: 'Proof submission deadline has passed',
            deadline: calculateProofDeadline(rift.itemType as any, rift.fundedAt, rift.serviceDate ? new Date(rift.serviceDate) : null).toISOString(),
            hoursOverdue: Math.abs(getHoursUntilProofDeadline(rift.itemType as any, rift.fundedAt, rift.serviceDate ? new Date(rift.serviceDate) : null)),
          },
          { status: 400 }
        )
      }
    }

    // Handle both FormData and JSON requests
    let proofPayload: any = {}
    let uploadedFiles: string[] = []
    const vaultAssetIds: string[] = []
    
    // Check content-type to determine if it's FormData or JSON
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (file uploads)
      const formData = await request.formData()
      const notes = formData.get('notes') as string | null
      const files = formData.getAll('files') as File[]
      const licenseKey = formData.get('licenseKey') as string | null
      const trackingNumber = formData.get('trackingNumber') as string | null
      const url = formData.get('url') as string | null
      const textContent = formData.get('textContent') as string | null
      
      // Extract all fields that might be needed for validation
      const softwareName = formData.get('softwareName') as string | null
      const licenseType = formData.get('licenseType') as string | null
      const eventName = formData.get('eventName') as string | null
      const eventDate = formData.get('eventDate') as string | null
      const platform = formData.get('platform') as string | null
      const deliverySummary = formData.get('deliverySummary') as string | null
      const scopeCompletion = formData.get('scopeCompletion') as string | null
      const urlSnapshot = formData.get('urlSnapshot') as string | null
      
      proofPayload = {
        notes: notes || undefined,
        softwareName: softwareName || undefined,
        licenseType: licenseType || undefined,
        eventName: eventName || undefined,
        eventDate: eventDate || undefined,
        platform: platform || undefined,
        deliverySummary: deliverySummary || undefined,
        scopeCompletion: scopeCompletion || undefined,
        urlSnapshot: urlSnapshot || undefined,
      }
      
      // Upload files to vault
      const uploadErrors: Array<{ fileName: string; error: string }> = []
      for (const file of files) {
        if (file && file.size > 0) {
          try {
            // Determine asset type based on item type
            let assetType: VaultAssetType = 'FILE'
            if (rift.itemType === 'TICKETS') {
              assetType = 'TICKET_PROOF'
            }
            
            const assetId = await uploadVaultAsset(rift.id, auth.userId, {
              assetType,
              file,
              fileName: file.name,
            })
            vaultAssetIds.push(assetId)
            uploadedFiles.push(assetId) // Keep for backward compatibility
          } catch (error: any) {
            console.error('Vault upload error:', error)
            uploadErrors.push({
              fileName: file.name,
              error: error.message || 'Failed to upload file to vault'
            })
            // Do NOT fallback to old system - fail fast with clear error
          }
        }
      }
      
      // If any uploads failed, return error with details
      if (uploadErrors.length > 0) {
        return NextResponse.json(
          { 
            error: 'Some files failed to upload',
            details: uploadErrors,
            message: `Failed to upload ${uploadErrors.length} file(s). Please check file size, type, and try again.`
          },
          { status: 400 }
        )
      }
      
      // Handle other asset types
      if (licenseKey) {
        const assetId = await uploadVaultAsset(rift.id, auth.userId, {
          assetType: 'LICENSE_KEY',
          licenseKey,
        })
        vaultAssetIds.push(assetId)
      }
      
      if (trackingNumber) {
        const assetId = await uploadVaultAsset(rift.id, auth.userId, {
          assetType: 'TRACKING',
          trackingNumber,
        })
        vaultAssetIds.push(assetId)
      }
      
      if (url) {
        const assetId = await uploadVaultAsset(rift.id, auth.userId, {
          assetType: 'URL',
          url,
        })
        vaultAssetIds.push(assetId)
      }
      
      if (textContent) {
        const assetId = await uploadVaultAsset(rift.id, auth.userId, {
          assetType: 'TEXT_INSTRUCTIONS',
          textContent,
        })
        vaultAssetIds.push(assetId)
      }
    } else {
      // Handle JSON request
      const body = await request.json()
      proofPayload = body.proofPayload || {}
      uploadedFiles = body.uploadedFiles || []
      
      // Handle vault assets from JSON
      if (body.vaultAssets) {
        const jsonUploadErrors: Array<{ assetType: string; error: string }> = []
        for (const asset of body.vaultAssets) {
          try {
            const assetId = await uploadVaultAsset(rift.id, auth.userId, asset)
            vaultAssetIds.push(assetId)
          } catch (error: any) {
            console.error('Vault asset upload error:', error)
            jsonUploadErrors.push({
              assetType: asset.assetType || 'UNKNOWN',
              error: error.message || 'Failed to upload asset'
            })
          }
        }
        
        // If any JSON asset uploads failed, return error
        if (jsonUploadErrors.length > 0) {
          return NextResponse.json(
            { 
              error: 'Some assets failed to upload',
              details: jsonUploadErrors,
              message: `Failed to upload ${jsonUploadErrors.length} asset(s). Please check and try again.`
            },
            { status: 400 }
          )
        }
      }
    }
    

    if (!proofPayload) {
      return NextResponse.json(
        { error: 'Proof payload is required' },
        { status: 400 }
      )
    }

    // TYPE-LOCKED VALIDATION: Ensure proof matches item type requirements
    if (vaultAssetIds.length > 0) {
      // Get asset types from uploaded assets
      const assets = await prisma.vault_assets.findMany({
        where: { id: { in: vaultAssetIds } },
        select: { assetType: true, sha256: true, id: true },
      })
      
      const assetTypes = assets.map(a => a.assetType)
      const assetHashes = assets.map(a => a.sha256)

      // AI Proof Classification - skip for now to prevent hanging
      // Classification will happen asynchronously in the verification job
      // This prevents blocking the proof submission response
      // Note: Classification is non-critical for submission - it's used for quality scoring
      // The proof will still be validated through the type lock validation below
      
      // Validate type lock
      const typeLockValidation = validateProofTypeLock(
        rift.itemType as any,
        assetTypes,
        proofPayload
      )
      
      if (!typeLockValidation.valid) {
        return NextResponse.json(
          {
            error: 'Proof does not meet item type requirements',
            details: typeLockValidation.errors,
          },
          { status: 400 }
        )
      }
      
      // DUPLICATE DETECTION: Check for reused proofs
      const duplicateCheck = await checkDuplicateProofs(
        assetHashes,
        rift.id,
        auth.userId
      )
      
      if (duplicateCheck.isDuplicate) {
        // Log duplicate detection but don't block submission (flag for review)
        await prisma.riftTransaction.update({
          where: { id: rift.id },
          data: {
            requiresManualReview: true,
            riskScore: Math.max(rift.riskScore || 0, duplicateCheck.riskLevel === 'CRITICAL' ? 90 : duplicateCheck.riskLevel === 'HIGH' ? 70 : 50),
          },
        })
        
        // Create admin alert
        await prisma.timelineEvent.create({
          data: {
        id: crypto.randomUUID(),
            escrowId: rift.id,
            type: 'DUPLICATE_PROOF_DETECTED',
            message: `⚠️ Duplicate proof detected (${duplicateCheck.riskLevel} risk). ${duplicateCheck.recommendations.join(' ')}`,
            createdById: null, // System event
          },
        })
        
        // For critical duplicates, block submission
        if (duplicateCheck.riskLevel === 'CRITICAL' && !duplicateCheck.duplicateRiftIds.every(id => id.startsWith('same-seller-'))) {
          return NextResponse.json(
            {
              error: 'Proof submission blocked: Critical duplicate detection',
              details: {
                riskLevel: duplicateCheck.riskLevel,
                duplicateRiftIds: duplicateCheck.duplicateRiftIds,
                recommendations: duplicateCheck.recommendations,
              },
            },
            { status: 403 }
          )
        }
      }
    }

    // Get proof type from item type
    const proofType = getProofTypeFromItemType(rift.itemType)

    // Queue verification job for asynchronous processing
    // This prevents blocking the HTTP response and improves user experience
    let verificationJobId: string | null = null
    let proofStatus: 'PENDING' | 'VALID' = 'PENDING'
    
    if (vaultAssetIds.length > 0) {
      try {
        const { queueVerificationJob } = await import('@/lib/queue/verification-queue')
        verificationJobId = await queueVerificationJob(
          rift.id,
          vaultAssetIds,
          {
            triggeredBy: 'proof-submission',
            triggeredByUserId: auth.userId,
            priority: 1, // Higher priority for new submissions
          }
        )
        console.log(`Queued verification job ${verificationJobId} for rift ${rift.id}`)
      } catch (error: any) {
        console.error('Failed to queue verification job:', error)
        // Continue with PENDING status - verification will need to be triggered manually
      }
    }

    // Use transaction to ensure data consistency
    // Note: Supabase operations (vault uploads) happen outside transaction
    // but we wrap Prisma operations in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Re-check rift status to prevent race conditions
      const currentRift = await tx.riftTransaction.findUnique({
        where: { id: rift.id },
        select: { status: true, version: true },
      })

      if (!currentRift) {
        throw new Error('Rift not found')
      }

      // Verify state hasn't changed (use state machine function)
      if (!canSellerSubmitProof(currentRift.status)) {
        throw new Error(`Cannot submit proof in ${currentRift.status} state`)
      }

      // Create proof record with status based on verification result
      const proof = await tx.proof.create({
        data: {
          id: randomUUID(),
          riftId: rift.id,
          proofType,
          proofPayload: proofPayload as any,
          uploadedFiles: uploadedFiles || [],
          status: proofStatus, // VALID if auto-approved, PENDING otherwise
          submittedAt: new Date(),
          validatedAt: (proofStatus as 'PENDING' | 'VALID') === 'VALID' ? new Date() : null, // Set validatedAt if auto-approved
          updatedAt: new Date(),
        },
      })

      // Transition state: PAID/FUNDED -> PROOF_SUBMITTED (only if currently PAID or FUNDED)
      // UNDER_REVIEW can also transition to PROOF_SUBMITTED (resubmission)
      // For TICKETS: Automatically transition to DELIVERED_PENDING_RELEASE when proof is uploaded
      let newStatus = currentRift.status
      if (currentRift.status === 'FUNDED' || currentRift.status === 'UNDER_REVIEW') {
        // For tickets, proof upload means transfer is sent, so mark as delivered
        const targetStatus = rift.itemType === 'TICKETS' ? 'DELIVERED_PENDING_RELEASE' : 'PROOF_SUBMITTED'
        await tx.riftTransaction.update({
          where: { 
            id: rift.id,
            version: currentRift.version, // Optimistic locking
          },
          data: {
            status: targetStatus,
            proofSubmittedAt: new Date(),
            version: { increment: 1 },
          },
        })
        newStatus = targetStatus
      }

      return { proof, newStatus }
    }, {
      timeout: 10000, // 10 second timeout
    })

    const { proof, newStatus } = result
    
    // Verification is now asynchronous - it will be processed by the worker
    // State transitions will happen automatically when verification completes
    // For now, check if manual review is required based on risk/amount
    
    const updatedRift = await prisma.riftTransaction.findUnique({
      where: { id: rift.id },
      select: { status: true, requiresManualReview: true, subtotal: true, riskScore: true },
    })
    
    if (updatedRift?.status === 'PROOF_SUBMITTED') {
      // Check if manual review is required
      const requiresReview =
        updatedRift.requiresManualReview ||
        (updatedRift.subtotal && updatedRift.subtotal > 1000) || // High amount
        updatedRift.riskScore > 50 // High risk
        
      if (requiresReview) {
        await transitionRiftState(rift.id, 'UNDER_REVIEW', {
          userId: auth.userId,
          reason: 'Manual review required',
        })
      }
    }

    // For TICKETS: Automatically mark transfer as sent when proof is uploaded
    if (rift.itemType === 'TICKETS') {
      try {
        const supabase = createServerClient()
        const buyer = await prisma.user.findUnique({
          where: { id: rift.buyerId },
          select: { email: true },
        })

        // Check if transfer record already exists
        const { data: existingTransfer } = await supabase
          .from('ticket_transfers')
          .select('*')
          .eq('rift_id', rift.id)
          .single()

        if (existingTransfer) {
          // Update existing transfer
          await supabase
            .from('ticket_transfers')
            .update({
              seller_claimed_sent_at: new Date().toISOString(),
              status: 'seller_sent',
            })
            .eq('rift_id', rift.id)
        } else {
          // Create new transfer record
          await supabase
            .from('ticket_transfers')
            .insert({
              rift_id: rift.id,
              provider: 'other',
              transfer_to_email: buyer?.email || '',
              seller_claimed_sent_at: new Date().toISOString(),
              status: 'seller_sent',
            })
        }

        // Log event
        const requestMeta = extractRequestMetadata(request)
        await logEvent(
          rift.id,
          RiftEventActorType.SELLER,
          auth.userId,
          'SELLER_CLAIMED_TRANSFER_SENT',
          {
            provider: 'other',
            autoClaimed: true, // Mark as auto-claimed via proof upload
          },
          requestMeta
        )
      } catch (ticketTransferError: any) {
        // Don't fail proof submission if ticket transfer creation fails
        console.error('Auto-claim ticket transfer error:', ticketTransferError)
      }
    }

    // Create timeline event
    const timelineMessage = 'Proof submitted - verification in progress'
    
    await prisma.timelineEvent.create({
      data: {
        id: crypto.randomUUID(),
        escrowId: rift.id,
        type: 'PROOF_SUBMITTED',
        message: timelineMessage,
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

    // Get final status after all transitions
    const finalRift = await prisma.riftTransaction.findUnique({
      where: { id: rift.id },
      select: { status: true },
    })
    
    const finalStatus = finalRift?.status || 'PROOF_SUBMITTED'
    
    // Determine status message
    const statusMessage = finalStatus === 'UNDER_REVIEW'
      ? 'Proof submitted successfully. It has been routed for manual review.'
      : 'Proof submitted successfully. Verification in progress.'
    
    return NextResponse.json({
      success: true,
      proofId: proof.id,
      status: finalStatus,
      proofStatus: 'PENDING', // Always PENDING until verification completes
      verificationJobId, // Include job ID for status polling
      message: statusMessage,
    })
  } catch (error: any) {
    console.error('Submit proof error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
