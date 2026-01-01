/**
 * Viewer-First Design for Sensitive Assets
 * Prevents raw access by default, forces viewer reveal, logs all access
 */

import { prisma } from './prisma'
import { getSecureFileUrl } from './vault'
import { logVaultEvent, hashString } from './vault-logging'
import { generateDynamicWatermarkOverlay, applyWatermarkOverlayToImage } from './watermarking'
import { createServerClient } from './supabase'

export interface ViewerContext {
  userId: string
  sessionId: string
  ipAddress: string
  userAgent: string
}

/**
 * Get viewer URL for sensitive asset (forces viewer access)
 * For tickets, license keys, and high-value digital assets
 */
export async function getViewerOnlyAssetUrl(
  assetId: string,
  riftId: string,
  context: ViewerContext,
  forceViewer: boolean = true
): Promise<{
  viewerUrl: string
  rawUrl?: never // Never return raw URL if forceViewer is true
  requiresViewer: boolean
}> {
  const asset = await prisma.vaultAsset.findUnique({
    where: { id: assetId },
    include: {
      rift: {
        select: {
          id: true,
          riftNumber: true,
          buyerId: true,
          itemType: true,
        },
      },
    },
  })
  
  if (!asset || asset.riftId !== riftId) {
    throw new Error('Asset not found')
  }
  
  // Verify viewer is the buyer
  if (asset.rift.buyerId !== context.userId) {
    throw new Error('Unauthorized: Only buyer can access assets')
  }
  
  // Determine if asset requires viewer-only access
  const sensitiveTypes: string[] = ['TICKET_PROOF', 'LICENSE_KEY']
  const requiresViewer = forceViewer || sensitiveTypes.includes(asset.assetType)
  
  // Log access attempt (before serving)
  await logVaultEvent({
    riftId,
    assetId,
    actorId: context.userId,
    actorRole: 'BUYER',
    eventType: asset.assetType === 'LICENSE_KEY' ? 'BUYER_REVEALED_LICENSE_KEY' : 'BUYER_OPENED_ASSET',
    ipHash: hashString(context.ipAddress),
    userAgentHash: hashString(context.userAgent),
    sessionId: context.sessionId,
    assetHash: asset.sha256,
  })
  
  // For images (tickets), apply dynamic watermark overlay
  if (asset.assetType === 'TICKET_PROOF' && asset.storagePath && asset.mimeDetected?.startsWith('image/')) {
    // Download original
    const supabase = createServerClient()
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('rift-vault')
      .download(asset.storagePath)
    
    if (!downloadError && fileData) {
      const imageBuffer = Buffer.from(await fileData.arrayBuffer())
      
      // Generate watermark with buyer identity
      const watermarkOverlay = await generateDynamicWatermarkOverlay(
        {
          transactionId: riftId,
          riftNumber: asset.rift.riftNumber,
          buyerId: context.userId,
          timestamp: new Date(),
        },
        context.userId, // Would need to fetch buyer email
        context.sessionId
      )
      
      // Apply overlay
      const watermarkedImage = await applyWatermarkOverlayToImage(imageBuffer, watermarkOverlay)
      
      // Upload watermarked version to temp location (or serve directly)
      // For now, return signed URL to original (viewer will overlay client-side)
      // TODO: Implement server-side watermark rendering service
    }
  }
  
  // Generate secure signed URL (viewer endpoint, not direct storage)
  // This ensures access goes through Rift-controlled endpoints
  const viewerUrl = `/api/rifts/${riftId}/vault/viewer/${assetId}?session=${context.sessionId}`
  
  return {
    viewerUrl,
    requiresViewer: true, // Always require viewer for sensitive assets
  }
}

/**
 * One-time reveal for license keys
 * After first reveal, subsequent access requires admin override
 */
export async function revealLicenseKeyOneTime(
  assetId: string,
  riftId: string,
  context: ViewerContext
): Promise<{
  licenseKey: string
  isFirstReveal: boolean
  canRevealAgain: boolean
}> {
  // Check if already revealed
  const existingReveal = await prisma.vaultEvent.findFirst({
    where: {
      riftId,
      assetId,
      actorId: context.userId,
      eventType: 'BUYER_REVEALED_LICENSE_KEY',
    },
    orderBy: { timestampUtc: 'asc' },
  })
  
  const isFirstReveal = !existingReveal
  
  if (!isFirstReveal) {
    // Already revealed - require admin override to reveal again
    // Check if admin override exists
    const adminOverride = await prisma.vaultEvent.findFirst({
      where: {
        riftId,
        assetId,
        actorRole: 'ADMIN',
        eventType: 'ADMIN_APPROVED_PROOF',
        metadata: {
          path: ['allowRevealAgain'],
          equals: true,
        },
      },
    })
    
    if (!adminOverride) {
      throw new Error('License key already revealed. Contact support to view again.')
    }
  }
  
  // Get asset
  const asset = await prisma.vaultAsset.findUnique({
    where: { id: assetId },
  })
  
  if (!asset || asset.riftId !== riftId || asset.assetType !== 'LICENSE_KEY') {
    throw new Error('License key asset not found')
  }
  
  if (!asset.encryptedData) {
    throw new Error('License key data not found')
  }
  
  // Decrypt
  const { decryptSensitiveData } = await import('./vault')
  const licenseKey = await decryptSensitiveData(asset.encryptedData)
  
  // Log reveal (already logged in getViewerOnlyAssetUrl, but log again for clarity)
  if (isFirstReveal) {
    await logVaultEvent({
      riftId,
      assetId,
      actorId: context.userId,
      actorRole: 'BUYER',
      eventType: 'BUYER_REVEALED_LICENSE_KEY',
      ipHash: hashString(context.ipAddress),
      userAgentHash: hashString(context.userAgent),
      sessionId: context.sessionId,
      assetHash: asset.sha256,
      metadata: {
        isFirstReveal: true,
        timestamp: new Date().toISOString(),
      },
    })
  }
  
  // Check for admin override if not first reveal
  let hasAdminOverride = false
  if (!isFirstReveal) {
    const adminOverrideCheck = await prisma.vaultEvent.findFirst({
      where: {
        riftId,
        assetId,
        actorRole: 'ADMIN',
        eventType: 'ADMIN_APPROVED_PROOF',
        metadata: {
          path: ['allowRevealAgain'],
          equals: true,
        },
      },
    })
    hasAdminOverride = !!adminOverrideCheck
  }

  return {
    licenseKey,
    isFirstReveal,
    canRevealAgain: !isFirstReveal && hasAdminOverride,
  }
}
