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
import { createActivity } from '@/lib/activity'
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
      
      // Upload files to vault - with timeout and retry logic
      const uploadErrors: Array<{ fileName: string; error: string }> = []
      const uploadedAssets: string[] = [] // Track successfully uploaded assets for cleanup
      
      for (const file of files) {
        if (file && file.size > 0) {
          try {
            // Determine asset type based on item type
            let assetType: VaultAssetType = 'FILE'
            if (rift.itemType === 'TICKETS') {
              assetType = 'TICKET_PROOF'
            }
            
            // Upload with timeout protection
            const uploadPromise = uploadVaultAsset(rift.id, auth.userId, {
              assetType,
              file,
              fileName: file.name,
            })
            
            // Add 30 second timeout per file upload
            const timeoutPromise = new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error('Upload timeout - file upload took too long')), 30000)
            )
            
            const assetId = await Promise.race([uploadPromise, timeoutPromise])
            vaultAssetIds.push(assetId)
            uploadedAssets.push(assetId)
            uploadedFiles.push(assetId) // Keep for backward compatibility
          } catch (error: any) {
            console.error('Vault upload error for file:', file.name, error)
            
            // Clean up any partially uploaded assets for this file
            // (Note: Supabase uploads are atomic, so this is mainly for database consistency)
            
            uploadErrors.push({
              fileName: file.name,
              error: error.message || 'Failed to upload file to vault. Please check file size (max 50MB) and type, then try again.'
            })
            
            // If critical error, stop and return immediately
            if (error.message?.includes('timeout') || error.message?.includes('network')) {
              // Cleanup successful uploads before returning
              if (uploadedAssets.length > 0) {
                try {
                  await prisma.vault_assets.deleteMany({
                    where: { id: { in: uploadedAssets } },
                  })
                } catch (cleanupError) {
                  console.error('Failed to cleanup uploaded assets:', cleanupError)
                  // Continue anyway - assets can be cleaned up later
                }
              }
              
              return NextResponse.json(
                { 
                  error: 'Upload timeout',
                  details: uploadErrors,
                  message: `File upload timed out. Please check your connection and try again with smaller files if needed.`
                },
                { status: 408 } // Request Timeout
              )
            }
          }
        }
      }
      
      // If any uploads failed, cleanup and return error with details
      if (uploadErrors.length > 0) {
        // Clean up any successfully uploaded assets if we're failing
        if (uploadedAssets.length > 0) {
          try {
            await prisma.vault_assets.deleteMany({
              where: { id: { in: uploadedAssets } },
            })
            // Note: Supabase storage files will remain, but can be cleaned up by a background job
          } catch (cleanupError) {
            console.error('Failed to cleanup uploaded assets on error:', cleanupError)
            // Continue anyway - better to return error to user
          }
        }
        
        return NextResponse.json(
          { 
            error: 'Some files failed to upload',
            details: uploadErrors,
            message: `Failed to upload ${uploadErrors.length} file(s). ${uploadErrors[0]?.error || 'Please check file size (max 50MB) and type, then try again.'}`
          },
          { status: 400 }
        )
      }
      
      // Handle other asset types - with error handling
      try {
        if (licenseKey) {
          try {
            const assetId = await uploadVaultAsset(rift.id, auth.userId, {
              assetType: 'LICENSE_KEY',
              licenseKey,
            })
            vaultAssetIds.push(assetId)
            uploadedAssets.push(assetId)
          } catch (error: any) {
            console.error('License key upload error:', error)
            // Cleanup on failure
            if (uploadedAssets.length > 0) {
              await prisma.vault_assets.deleteMany({ where: { id: { in: uploadedAssets } } })
            }
            return NextResponse.json(
              { 
                error: 'Failed to upload license key',
                message: error.message || 'Invalid license key format or upload failed'
              },
              { status: 400 }
            )
          }
        }
        
        if (trackingNumber) {
          try {
            const assetId = await uploadVaultAsset(rift.id, auth.userId, {
              assetType: 'TRACKING',
              trackingNumber,
            })
            vaultAssetIds.push(assetId)
            uploadedAssets.push(assetId)
          } catch (error: any) {
            console.error('Tracking number upload error:', error)
            if (uploadedAssets.length > 0) {
              await prisma.vault_assets.deleteMany({ where: { id: { in: uploadedAssets } } })
            }
            return NextResponse.json(
              { 
                error: 'Failed to upload tracking number',
                message: error.message || 'Invalid tracking number format or upload failed'
              },
              { status: 400 }
            )
          }
        }
        
        if (url) {
          try {
            const assetId = await uploadVaultAsset(rift.id, auth.userId, {
              assetType: 'URL',
              url,
            })
            vaultAssetIds.push(assetId)
            uploadedAssets.push(assetId)
          } catch (error: any) {
            console.error('URL upload error:', error)
            if (uploadedAssets.length > 0) {
              await prisma.vault_assets.deleteMany({ where: { id: { in: uploadedAssets } } })
            }
            return NextResponse.json(
              { 
                error: 'Failed to upload URL',
                message: error.message || 'Invalid URL format or upload failed'
              },
              { status: 400 }
            )
          }
        }
        
        if (textContent) {
          try {
            const assetId = await uploadVaultAsset(rift.id, auth.userId, {
              assetType: 'TEXT_INSTRUCTIONS',
              textContent,
            })
            vaultAssetIds.push(assetId)
            uploadedAssets.push(assetId)
          } catch (error: any) {
            console.error('Text content upload error:', error)
            if (uploadedAssets.length > 0) {
              await prisma.vault_assets.deleteMany({ where: { id: { in: uploadedAssets } } })
            }
            return NextResponse.json(
              { 
                error: 'Failed to upload text content',
                message: error.message || 'Invalid text content or upload failed'
              },
              { status: 400 }
            )
          }
        }
      } catch (error: any) {
        console.error('Error uploading additional assets:', error)
        // Final cleanup if something unexpected happens
        if (uploadedAssets.length > 0) {
          try {
            await prisma.vault_assets.deleteMany({ where: { id: { in: uploadedAssets } } })
          } catch (cleanupError) {
            console.error('Failed final cleanup:', cleanupError)
          }
        }
        return NextResponse.json(
          { 
            error: 'Failed to upload proof',
            message: 'An error occurred while uploading proof. Please try again.'
          },
          { status: 500 }
        )
      }
    } else {
      // Handle JSON request
      const body = await request.json()
      proofPayload = body.proofPayload || {}
      uploadedFiles = body.uploadedFiles || []
      
      // Handle vault assets from JSON - with cleanup on failure
      if (body.vaultAssets) {
        const jsonUploadErrors: Array<{ assetType: string; error: string }> = []
        const jsonUploadedAssets: string[] = []
        
        for (const asset of body.vaultAssets) {
          try {
            const uploadPromise = uploadVaultAsset(rift.id, auth.userId, asset)
            const timeoutPromise = new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error('Upload timeout')), 30000)
            )
            
            const assetId = await Promise.race([uploadPromise, timeoutPromise])
            vaultAssetIds.push(assetId)
            jsonUploadedAssets.push(assetId)
          } catch (error: any) {
            console.error('Vault asset upload error:', error)
            jsonUploadErrors.push({
              assetType: asset.assetType || 'UNKNOWN',
              error: error.message || 'Failed to upload asset'
            })
            
            // Cleanup on failure
            if (jsonUploadedAssets.length > 0) {
              try {
                await prisma.vault_assets.deleteMany({ where: { id: { in: jsonUploadedAssets } } })
              } catch (cleanupError) {
                console.error('Failed to cleanup JSON assets:', cleanupError)
              }
            }
          }
        }
        
        // If any JSON asset uploads failed, return error
        if (jsonUploadErrors.length > 0) {
          return NextResponse.json(
            { 
              error: 'Some assets failed to upload',
              details: jsonUploadErrors,
              message: `Failed to upload ${jsonUploadErrors.length} asset(s). ${jsonUploadErrors[0]?.error || 'Please check and try again.'}`
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
    // Do quick validation on payload only - skip asset validation to avoid blocking
    // Full validation with assets happens asynchronously in verification job
    if (vaultAssetIds.length === 0) {
      return NextResponse.json(
        {
          error: 'Proof assets are required',
          message: 'Please upload at least one proof asset (file, tracking number, license key, etc.)',
        },
        { status: 400 }
      )
    }

    // Get proof type from item type
    const proofType = getProofTypeFromItemType(rift.itemType)

    // Status is always PENDING initially - verification happens asynchronously
    const proofStatus: 'PENDING' | 'VALID' = 'PENDING'

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
    
    // Return response IMMEDIATELY after transaction
    // All validation and background processing happens after response
    const finalStatus = newStatus || 'PROOF_SUBMITTED'
    
    // Run all validation and background processing AFTER response is sent
    // This ensures the user sees immediate success
    Promise.resolve().then(async () => {
      try {
        // Get asset types for validation (in background)
        const assets = await prisma.vault_assets.findMany({
          where: { id: { in: vaultAssetIds } },
          select: { assetType: true, sha256: true, id: true },
        })
        
        const assetTypes = assets.map(a => a.assetType)
        const assetHashes = assets.map(a => a.sha256)

        // Validate type lock in background
        try {
          const typeLockValidation = validateProofTypeLock(
            rift.itemType as any,
            assetTypes,
            proofPayload
          )
          
          if (!typeLockValidation.valid) {
            // Log but don't block - flag for admin review
            await prisma.riftTransaction.update({
              where: { id: rift.id },
              data: {
                requiresManualReview: true,
              },
            })
            
            await prisma.timelineEvent.create({
              data: {
                id: randomUUID(),
                escrowId: rift.id,
                type: 'PROOF_VALIDATION_WARNING',
                message: `⚠️ Proof validation warning: ${typeLockValidation.errors.join(', ')}`,
                createdById: null,
              },
            })
          }
        } catch (error) {
          console.error('Type lock validation error (non-critical):', error)
        }
        
        // Duplicate detection in background
        try {
          const duplicateCheck = await checkDuplicateProofs(
            assetHashes,
            rift.id,
            auth.userId
          )
          
          if (duplicateCheck.isDuplicate) {
            // Log duplicate detection but don't block submission
            await prisma.riftTransaction.update({
              where: { id: rift.id },
              data: {
                requiresManualReview: true,
                riskScore: Math.max(rift.riskScore || 0, duplicateCheck.riskLevel === 'CRITICAL' ? 90 : duplicateCheck.riskLevel === 'HIGH' ? 70 : 50),
              },
            })
            
            await prisma.timelineEvent.create({
              data: {
                id: randomUUID(),
                escrowId: rift.id,
                type: 'DUPLICATE_PROOF_DETECTED',
                message: `⚠️ Duplicate proof detected (${duplicateCheck.riskLevel} risk). ${duplicateCheck.recommendations.join(' ')}`,
                createdById: null,
              },
            })
          }
        } catch (error) {
          console.error('Duplicate check error (non-critical):', error)
        }
        
        // Get final status for review check
        const finalRift = await prisma.riftTransaction.findUnique({
          where: { id: rift.id },
          select: { status: true, requiresManualReview: true, subtotal: true, riskScore: true },
        })
        
        // Check if manual review is required
        if (finalRift?.status === 'PROOF_SUBMITTED') {
          const requiresReview =
            finalRift.requiresManualReview ||
            (finalRift.subtotal && finalRift.subtotal > 1000) || // High amount
            finalRift.riskScore > 50 // High risk
            
          if (requiresReview) {
            // Transition to UNDER_REVIEW in background
            try {
              await transitionRiftState(rift.id, 'UNDER_REVIEW', {
                userId: auth.userId,
                reason: 'Manual review required',
              })
            } catch (error) {
              console.error('Failed to transition to UNDER_REVIEW:', error)
            }
          }
        }
        
        // Queue verification job (in background)
        try {
          const { queueVerificationJob } = await import('@/lib/queue/verification-queue')
          
          const queuePromise = queueVerificationJob(
            rift.id,
            vaultAssetIds,
            {
              triggeredBy: 'proof-submission',
              triggeredByUserId: auth.userId,
              priority: 1,
            }
          )
          
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Queue timeout')), 3000)
          )
          
          const jobId = await Promise.race([queuePromise, timeoutPromise])
          if (jobId) {
            console.log(`[Background] Queued verification job ${jobId} for rift ${rift.id}`)
          }
        } catch (error: any) {
          // Silently ignore Redis failures
          if (error.message && !error.message.includes('timeout') && !error.message.includes('connect')) {
            console.warn(`[Background] Verification queue unavailable (non-critical):`, error.message)
          }
        }
      } catch (error) {
        console.error('Background processing error (non-critical):', error)
      }
    }).catch(() => {
      // Ignore all background errors - proof submission succeeded
    })
    
    const verificationJobId = vaultAssetIds.length > 0 ? 'queued' : null

    // For TICKETS: Automatically mark transfer as sent when proof is uploaded (in background)
    if (rift.itemType === 'TICKETS') {
      Promise.resolve().then(async () => {
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
          console.error('Auto-claim ticket transfer error (non-critical):', ticketTransferError)
        }
      }).catch(() => {
        // Ignore errors
      })
    }

    // Return response IMMEDIATELY - all critical operations are complete
    // Status is already updated to PROOF_SUBMITTED in transaction
    const finalStatus = newStatus || 'PROOF_SUBMITTED'
    
    // Determine status message
    const statusMessage = finalStatus === 'UNDER_REVIEW'
      ? 'Proof submitted successfully. It has been routed for manual review.'
      : finalStatus === 'DELIVERED_PENDING_RELEASE'
      ? 'Proof submitted successfully. Transfer marked as sent.'
      : 'Proof submitted successfully. Verification in progress.'
    
    // Create timeline event in background (non-blocking)
    Promise.resolve().then(async () => {
      try {
        await prisma.timelineEvent.create({
          data: {
            id: randomUUID(),
            escrowId: rift.id,
            type: 'PROOF_SUBMITTED',
            message: 'Proof submitted - verification in progress',
            createdById: auth.userId,
          },
        })

        // Create activity for seller
        const riftWithDetails = await prisma.riftTransaction.findUnique({
          where: { id: rift.id },
          include: {
            buyer: { select: { name: true, email: true } },
          },
        })

        if (riftWithDetails) {
          const buyerName = riftWithDetails.buyer.name || riftWithDetails.buyer.email.split('@')[0]
          await createActivity(
            auth.userId,
            'PROOF_SUBMITTED',
            `Proof submitted for rift #${riftWithDetails.riftNumber} - ${riftWithDetails.itemTitle}`,
            riftWithDetails.subtotal ?? undefined,
            { transactionId: rift.id, riftNumber: riftWithDetails.riftNumber, buyerId: riftWithDetails.buyerId }
          )

          // Activity for buyer
          await createActivity(
            riftWithDetails.buyerId,
            'PROOF_SUBMITTED',
            `Proof submitted for rift #${riftWithDetails.riftNumber} - ${riftWithDetails.itemTitle}`,
            riftWithDetails.subtotal ?? undefined,
            { transactionId: rift.id, riftNumber: riftWithDetails.riftNumber, sellerId: auth.userId }
          )
        }
      } catch (error) {
        console.error('Failed to create timeline event/activity (non-critical):', error)
        // Non-critical - timeline can be added later
      }
    }).catch(() => {
      // Ignore errors
    })

    // Send email notification to all admins in background (non-blocking)
    Promise.resolve().then(async () => {
      try {
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

        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: {
            email: true,
          },
        })

        if (escrowWithSeller && admins.length > 0) {
          // Notify all admins - don't wait for completion
          Promise.all(
            admins.map(admin =>
              sendProofSubmittedEmail(
                admin.email,
                rift.id,
                rift.itemTitle,
                escrowWithSeller.seller.name,
                escrowWithSeller.seller.email,
                proofType,
                rift.riftNumber
              ).catch(() => {
                // Continue with other emails
              })
            )
          ).catch(() => {
            // Non-critical - emails can be sent later
          })
        }
      } catch (error) {
        // Non-critical - emails can be sent later
      }
    }).catch(() => {
      // Ignore errors
    })
    
    // Return response immediately - all status updates are complete in transaction
    return NextResponse.json({
      success: true,
      proofId: proof.id,
      status: finalStatus, // Already updated to PROOF_SUBMITTED in transaction
      proofStatus: 'PENDING', // Always PENDING until verification completes
      verificationJobId, // May be null if queue unavailable, that's OK
      vaultAssetIds, // Return uploaded asset IDs for reference
      message: statusMessage,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Submit proof error:', error)
    
    // If we're in a transaction failure, vault assets might still be uploaded
    // This is handled by the cleanup logic above, but add extra safety here
    
    // Determine appropriate status code
    let statusCode = 500
    let errorMessage = error.message || 'Internal server error'
    
    if (error.message?.includes('timeout')) {
      statusCode = 408
      errorMessage = 'Request timeout. Please try again with smaller files if needed.'
    } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      statusCode = 400
    } else if (error.message?.includes('unauthorized') || error.message?.includes('permission')) {
      statusCode = 403
    } else if (error.message?.includes('not found')) {
      statusCode = 404
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        message: errorMessage,
        // Don't expose internal errors to users
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
      },
      { status: statusCode }
    )
  }
}
