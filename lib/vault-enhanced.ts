/**
 * Enhanced Rift Vault System
 * Handles asset uploads, access control, and comprehensive logging
 */

import { prisma } from './prisma'
import { VaultAssetType, VaultEventType, VaultActorRole } from '@prisma/client'
import { uploadToVault, generateFileHash, getSecureFileUrl, validateFileType, getAllowedFileTypes } from './vault'
import { createHash, randomUUID } from 'crypto'
import { logVaultEvent } from './vault-logging'
import { createServerClient } from './supabase'

export interface VaultAssetInput {
  assetType: VaultAssetType
  file?: File | Buffer // Support both File (browser) and Buffer (server)
  licenseKey?: string
  trackingNumber?: string
  url?: string
  textContent?: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
}

/**
 * Upload asset to Rift Vault
 */
export async function uploadVaultAsset(
  riftId: string,
  uploaderId: string,
  input: VaultAssetInput
): Promise<string> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  // Verify seller can upload (must be in FUNDED or PROOF_SUBMITTED state)
  if (rift.status !== 'FUNDED' && rift.status !== 'PROOF_SUBMITTED') {
    throw new Error(`Cannot upload proof in ${rift.status} state. Rift must be in FUNDED or PROOF_SUBMITTED state.`)
  }

  // Verify uploader is the seller
  if (uploaderId !== rift.sellerId) {
    throw new Error('Only seller can upload proof assets')
  }

  let sha256: string
  let storagePath: string | null = null
  let fileName: string | null = null
  let mimeDetected: string | null = null
  let encryptedData: string | null = null

  // Handle different asset types
  switch (input.assetType) {
    case 'FILE':
      if (!input.file) {
        throw new Error('File is required for FILE asset type')
      }
      
      // Validate file size (max 50MB)
      const maxFileSize = 50 * 1024 * 1024 // 50MB
      const fileSize = input.file instanceof Buffer 
        ? input.file.length 
        : (input.file as File).size || 0
      
      if (fileSize > maxFileSize) {
        throw new Error(`File size exceeds maximum allowed (50MB). File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`)
      }
      
      if (fileSize < 100) {
        throw new Error('File is too small (minimum 100 bytes)')
      }
      
      // Validate file type
      if (input.file instanceof File) {
        const allowedTypes = getAllowedFileTypes(rift.itemType)
        if (allowedTypes.length > 0 && !validateFileType(input.file, allowedTypes)) {
          throw new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`)
        }
      } else if (input.mimeType) {
        // For Buffer, validate MIME type if provided
        const allowedTypes = getAllowedFileTypes(rift.itemType)
        if (allowedTypes.length > 0 && !allowedTypes.includes(input.mimeType)) {
          throw new Error(`File type not allowed. Allowed MIME type: ${input.mimeType}`)
        }
      }
      
      // Handle both File and Buffer
      let fileForUpload: File
      if (input.file instanceof Buffer) {
        // Convert Buffer to File-like object for uploadToVault
        // Note: uploadToVault expects File, but we can work around this
        // For now, we'll compute hash directly and store separately
        sha256 = await generateFileHash(input.file)
        // Store file using Supabase directly
        const supabase = createServerClient()
        const fileExt = input.fileName?.split('.').pop() || 'bin'
        const timestamp = Date.now()
        const uniqueName = `${timestamp}-${sha256.substring(0, 8)}.${fileExt}`
        const folder = 'vault'
        storagePath = `${folder}/${riftId}/${uniqueName}`
        
        const { error: uploadError } = await supabase.storage
          .from('rift-vault')
          .upload(storagePath, input.file, {
            contentType: input.mimeType || 'application/octet-stream',
            upsert: false,
          })
        
        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`)
        }
        
        fileName = input.fileName || uniqueName
        mimeDetected = input.mimeType || 'application/octet-stream'
      } else if (input.file instanceof File) {
        const fileMetadata = await uploadToVault(input.file, riftId, uploaderId)
        sha256 = fileMetadata.fileHash
        storagePath = fileMetadata.storagePath
        fileName = fileMetadata.fileName
        mimeDetected = fileMetadata.mimeType
      }
      break

    case 'LICENSE_KEY':
      if (!input.licenseKey) {
        throw new Error('License key is required for LICENSE_KEY asset type')
      }
      // Validate license key format (basic validation)
      if (input.licenseKey.length < 5 || input.licenseKey.length > 500) {
        throw new Error('License key must be between 5 and 500 characters')
      }
      // Only allow alphanumeric, hyphens, and underscores
      if (!/^[A-Za-z0-9\-_]+$/.test(input.licenseKey)) {
        throw new Error('License key contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed.')
      }
      // Encrypt license key using proper encryption
      const keyBuffer = Buffer.from(input.licenseKey)
      sha256 = createHash('sha256').update(keyBuffer).digest('hex')
      const { encryptSensitiveData } = await import('./vault')
      encryptedData = await encryptSensitiveData(input.licenseKey)
      break

    case 'TRACKING':
      if (!input.trackingNumber) {
        throw new Error('Tracking number is required for TRACKING asset type')
      }
      sha256 = createHash('sha256')
        .update(input.trackingNumber)
        .digest('hex')
      break

    case 'URL':
      if (!input.url) {
        throw new Error('URL is required for URL asset type')
      }
      // Validate URL format
      try {
        const urlObj = new URL(input.url)
        // Validate protocol (must be http or https)
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error('URL must use HTTP or HTTPS protocol')
        }
      } catch (error: any) {
        if (error.message.includes('protocol')) {
          throw error
        }
        throw new Error('Invalid URL format')
      }
      sha256 = createHash('sha256').update(input.url).digest('hex')
      break

    case 'TEXT_INSTRUCTIONS':
      if (!input.textContent) {
        throw new Error('Text content is required for TEXT_INSTRUCTIONS asset type')
      }
      sha256 = createHash('sha256').update(input.textContent).digest('hex')
      break

    case 'TICKET_PROOF':
      if (!input.file) {
        throw new Error('File is required for TICKET_PROOF asset type')
      }
      
      // Validate file size (max 50MB)
      const maxTicketFileSize = 50 * 1024 * 1024 // 50MB
      const ticketFileSize = input.file instanceof Buffer 
        ? input.file.length 
        : input.file.size
      
      if (ticketFileSize > maxTicketFileSize) {
        throw new Error(`File size exceeds maximum allowed (50MB). File size: ${(ticketFileSize / 1024 / 1024).toFixed(2)}MB`)
      }
      
      if (ticketFileSize < 100) {
        throw new Error('File is too small (minimum 100 bytes)')
      }
      
      // Validate file type for ticket proofs (images and PDFs)
      const allowedTicketTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
      ]
      
      if (input.file instanceof File) {
        if (!validateFileType(input.file, allowedTicketTypes)) {
          throw new Error(`Ticket proof file type not allowed. Allowed types: ${allowedTicketTypes.join(', ')}`)
        }
      } else if (input.mimeType && !allowedTicketTypes.includes(input.mimeType)) {
        throw new Error(`Ticket proof file type not allowed. Allowed MIME type: ${input.mimeType}`)
      }
      
      // Handle both File and Buffer (same as FILE case)
      if (input.file instanceof Buffer) {
        sha256 = await generateFileHash(input.file)
        const supabase = createServerClient()
        const fileExt = input.fileName?.split('.').pop() || 'bin'
        const timestamp = Date.now()
        const uniqueName = `${timestamp}-${sha256.substring(0, 8)}.${fileExt}`
        const folder = 'vault'
        storagePath = `${folder}/${riftId}/${uniqueName}`
        
        const { error: uploadError } = await supabase.storage
          .from('rift-vault')
          .upload(storagePath, input.file, {
            contentType: input.mimeType || 'application/octet-stream',
            upsert: false,
          })
        
        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`)
        }
        
        fileName = input.fileName || uniqueName
        mimeDetected = input.mimeType || 'application/octet-stream'
      } else {
        const ticketMetadata = await uploadToVault(input.file, riftId, uploaderId)
        sha256 = ticketMetadata.fileHash
        storagePath = ticketMetadata.storagePath
        fileName = ticketMetadata.fileName
        mimeDetected = ticketMetadata.mimeType
      }
      break

    default:
      throw new Error(`Unsupported asset type: ${input.assetType}`)
  }

  // Create vault asset record
  const asset = await prisma.vaultAsset.create({
    data: {
      id: randomUUID(),
      riftId,
      uploaderId,
      assetType: input.assetType,
      storagePath,
      fileName,
      sha256,
      mimeDetected,
      encryptedData,
      url: input.url || null,
      trackingNumber: input.trackingNumber || null,
      textContent: input.textContent || null,
      scanStatus: 'PENDING',
    },
  })

  // Log upload event
  await logVaultEvent({
    riftId,
    assetId: asset.id,
    actorId: uploaderId,
    actorRole: 'SELLER',
    eventType: 'SELLER_UPLOADED_ASSET',
    metadata: {
      assetType: input.assetType,
      fileName: fileName || undefined,
    },
  })

  return asset.id
}

/**
 * Get vault assets for a Rift (with role-based access)
 */
export async function getVaultAssets(
  riftId: string,
  viewerId: string,
  viewerRole: 'BUYER' | 'SELLER' | 'ADMIN'
): Promise<any[]> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: {
      buyer: true,
      seller: true,
    },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  // Verify access permissions
  if (viewerRole === 'BUYER' && viewerId !== rift.buyerId) {
    throw new Error('Unauthorized: Not the buyer')
  }
  if (viewerRole === 'SELLER' && viewerId !== rift.sellerId) {
    throw new Error('Unauthorized: Not the seller')
  }

  // Buyer can only access vault starting at PROOF_SUBMITTED
  if (viewerRole === 'BUYER' && !['PROOF_SUBMITTED', 'UNDER_REVIEW', 'RELEASED', 'PAYOUT_SCHEDULED', 'PAID_OUT'].includes(rift.status)) {
    throw new Error('Vault not yet accessible. Proof must be submitted first.')
  }

  // Get assets
  const assets = await prisma.vaultAsset.findMany({
    where: { riftId },
    orderBy: { createdAt: 'asc' },
  })

  // Return role-based view
  return assets.map((asset) => {
    const base = {
      id: asset.id,
      assetType: asset.assetType,
      fileName: asset.fileName,
      createdAt: asset.createdAt,
      scanStatus: asset.scanStatus,
      qualityScore: asset.qualityScore,
    }

    if (viewerRole === 'ADMIN') {
      // Admin sees everything
      return {
        ...base,
        sha256: asset.sha256,
        mimeDetected: asset.mimeDetected,
        metadataJson: asset.metadataJson,
        storagePath: asset.storagePath,
        encryptedData: asset.encryptedData,
        url: asset.url,
        trackingNumber: asset.trackingNumber,
        textContent: asset.textContent,
      }
    }

    if (viewerRole === 'SELLER') {
      // Seller sees what they uploaded + logs
      return {
        ...base,
        url: asset.url,
        trackingNumber: asset.trackingNumber,
        textContent: asset.textContent,
      }
    }

    if (viewerRole === 'BUYER') {
      // Buyer sees accessible content (files, keys after reveal, etc.)
      return {
        ...base,
        url: asset.url,
        trackingNumber: asset.trackingNumber,
        textContent: asset.textContent,
        // License key only if revealed (check events)
        licenseKeyRevealed: asset.assetType === 'LICENSE_KEY' ? false : undefined,
      }
    }

    return base
  })
}

/**
 * Buyer opens a vault asset (logged)
 */
export async function buyerOpenAsset(
  riftId: string,
  assetId: string,
  buyerId: string,
  context: {
    ipHash?: string
    userAgentHash?: string
    sessionId?: string
    deviceFingerprint?: string
  }
): Promise<{ url?: string; content?: string }> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  if (rift.buyerId !== buyerId) {
    throw new Error('Unauthorized: Not the buyer')
  }

  // Buyer can only access vault starting at PROOF_SUBMITTED
  if (!['PROOF_SUBMITTED', 'UNDER_REVIEW', 'RELEASED', 'PAYOUT_SCHEDULED', 'PAID_OUT'].includes(rift.status)) {
    throw new Error('Vault not yet accessible')
  }

  const asset = await prisma.vaultAsset.findUnique({
    where: { id: assetId },
  })

  if (!asset || asset.riftId !== riftId) {
    throw new Error('Asset not found')
  }

  // Log the access
  await logVaultEvent({
    riftId,
    assetId,
    actorId: buyerId,
    actorRole: 'BUYER',
    eventType: 'BUYER_OPENED_ASSET',
    ipHash: context.ipHash,
    userAgentHash: context.userAgentHash,
    sessionId: context.sessionId,
    deviceFingerprint: context.deviceFingerprint,
    assetHash: asset.sha256,
  })
  
  // Update auto-release deadline based on first access (non-blocking)
  // This allows auto-release to trigger based on buyer access timing
  try {
    const { updateAutoReleaseDeadline } = await import('./auto-release-enhanced')
    await updateAutoReleaseDeadline(riftId).catch(err => {
      console.error('Failed to update auto-release deadline:', err)
      // Non-critical, continue
    })
  } catch (err) {
    // Ignore errors in auto-release update
  }

  // Return appropriate content
  if (asset.storagePath) {
    const url = await getSecureFileUrl(asset.storagePath)
    return { url }
  }

  if (asset.url) {
    return { url: asset.url }
  }

  if (asset.textContent) {
    return { content: asset.textContent }
  }

  if (asset.trackingNumber) {
    return { content: asset.trackingNumber }
  }

  throw new Error('Asset has no accessible content')
}

/**
 * Buyer reveals license key (logged, one-time)
 */
export async function buyerRevealLicenseKey(
  riftId: string,
  assetId: string,
  buyerId: string,
  context: {
    ipHash?: string
    userAgentHash?: string
    sessionId?: string
    deviceFingerprint?: string
  }
): Promise<string> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  if (rift.buyerId !== buyerId) {
    throw new Error('Unauthorized: Not the buyer')
  }

  const asset = await prisma.vaultAsset.findUnique({
    where: { id: assetId },
  })

  if (!asset || asset.riftId !== riftId || asset.assetType !== 'LICENSE_KEY') {
    throw new Error('License key asset not found')
  }

  // Check if already revealed (check events)
  const existingReveal = await prisma.vaultEvent.findFirst({
    where: {
      riftId,
      assetId,
      actorId: buyerId,
      eventType: 'BUYER_REVEALED_LICENSE_KEY',
    },
  })

  if (existingReveal) {
    // Already revealed, return the key
    if (!asset.encryptedData) {
      throw new Error('License key data not found')
    }
    // Proper decryption
    const { decryptSensitiveData } = await import('./vault')
    return await decryptSensitiveData(asset.encryptedData)
  }

  // Log the reveal
  await logVaultEvent({
    riftId,
    assetId,
    actorId: buyerId,
    actorRole: 'BUYER',
    eventType: 'BUYER_REVEALED_LICENSE_KEY',
    ipHash: context.ipHash,
    userAgentHash: context.userAgentHash,
    sessionId: context.sessionId,
    deviceFingerprint: context.deviceFingerprint,
    assetHash: asset.sha256,
  })
  
  // Update auto-release deadline based on first access (non-blocking)
  try {
    const { updateAutoReleaseDeadline } = await import('./auto-release-enhanced')
    await updateAutoReleaseDeadline(riftId).catch(err => {
      console.error('Failed to update auto-release deadline:', err)
    })
  } catch (err) {
    // Ignore errors
  }

  // Decrypt and return
  if (!asset.encryptedData) {
    throw new Error('License key data not found')
  }
  // Proper decryption
  const { decryptSensitiveData } = await import('./vault')
  return await decryptSensitiveData(asset.encryptedData)
}

/**
 * Buyer downloads file (logged, if enabled)
 */
export async function buyerDownloadFile(
  riftId: string,
  assetId: string,
  buyerId: string,
  context: {
    ipHash?: string
    userAgentHash?: string
    sessionId?: string
    deviceFingerprint?: string
  }
): Promise<string> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  if (rift.buyerId !== buyerId) {
    throw new Error('Unauthorized: Not the buyer')
  }

  const asset = await prisma.vaultAsset.findUnique({
    where: { id: assetId },
  })

  if (!asset || asset.riftId !== riftId || !asset.storagePath) {
    throw new Error('File asset not found')
  }

  // Log the download
  await logVaultEvent({
    riftId,
    assetId,
    actorId: buyerId,
    actorRole: 'BUYER',
    eventType: 'BUYER_DOWNLOADED_FILE',
    ipHash: context.ipHash,
    userAgentHash: context.userAgentHash,
    sessionId: context.sessionId,
    deviceFingerprint: context.deviceFingerprint,
    assetHash: asset.sha256,
  })

  return await getSecureFileUrl(asset.storagePath, 3600) // 1 hour expiry
}

