/**
 * Admin Verification Pipeline
 * Performs integrity, safety, and proof quality checks on vault assets
 */

import { prisma } from './prisma'
import { VaultAsset, VaultScanStatus, VaultAssetType } from '@prisma/client'
import { createHash } from 'crypto'
import { createServerClient } from './supabase'
import { logVaultEvent } from './vault-logging'
import { analyzeImageWithAI } from './vault-ai-analysis'

export interface VerificationResult {
  passed: boolean
  scanStatus: VaultScanStatus
  qualityScore: number // 0-100
  metadata: {
    pageCount?: number
    textLength?: number
    language?: string
    creationDate?: Date
    imageCount?: number
    fileType?: string
    sizeBytes?: number
    entropy?: number
    issues: string[]
    aiAnalysis?: {
      category?: string
      documentType?: string
      extractedText?: string
      textConfidence?: number
      clarityScore?: number
      qualityIssues?: string[]
      suspiciousElements?: string[]
      extractedData?: {
        trackingNumbers?: string[]
        trackingCarriers?: string[]
        monetaryAmounts?: { value: number; currency?: string; confidence: number }[]
        dates?: { value: string; type?: string; confidence: number }[]
        orderIds?: string[]
        ticketNumbers?: string[]
        confirmationCodes?: string[]
        licenseKeys?: string[]
        shippingAddresses?: string[]
        qrCodes?: { data: string; confidence: number }[]
        barcodes?: { data: string; type?: string; confidence: number }[]
        confidenceScores?: Record<string, number>
      }
      isScreenshot?: boolean
      screenshotConfidence?: number
      exifData?: {
        present: boolean
        location?: { lat?: number; lon?: number }
        device?: string
        timestamp?: Date
        wasStripped?: boolean
      }
      timestampAnalysis?: {
        extractedDates: Date[]
        isRecent: boolean
        isFuture: boolean
        matchesSubmissionTime: boolean
        issues: string[]
      }
      amountValidation?: {
        extractedAmounts: number[]
        matchesRiftAmount: boolean
        variancePercent: number
        currencyMatch: boolean
        issues: string[]
      }
      detectedBrands?: string[]
      detectedLanguage?: string
    }
  }
  shouldRouteToReview: boolean
  reasons: string[]
}

/**
 * Step A: Integrity & Safety Checks (automatic, required)
 */
async function performIntegrityChecks(
  asset: VaultAsset
): Promise<{
  passed: boolean
  scanStatus: VaultScanStatus
  issues: string[]
}> {
  const issues: string[] = []

  // Hash verification
  if (!asset.sha256 || asset.sha256.length !== 64) {
    issues.push('Invalid SHA-256 hash')
    return { passed: false, scanStatus: 'FAIL', issues }
  }

  // File type verification (if file)
  if (asset.assetType === 'FILE' || asset.assetType === 'TICKET_PROOF') {
    if (!asset.storagePath) {
      issues.push('File storage path missing')
      return { passed: false, scanStatus: 'FAIL', issues }
    }

    // Verify file exists in storage (check specific file, not just folder)
    const supabase = createServerClient()
    const fileName = asset.storagePath.split('/').pop()
    const folderPath = asset.storagePath.split('/').slice(0, -1).join('/')
    
    // List files in folder and check if our file exists
    const { data, error } = await supabase.storage
      .from('rift-vault')
      .list(folderPath)

    if (error) {
      issues.push(`File storage check failed: ${error.message}`)
      return { passed: false, scanStatus: 'FAIL', issues }
    }
    
    // Check if the specific file exists in the list
    const fileExists = data?.some(file => file.name === fileName)
    if (!fileExists) {
      issues.push('File not found in storage')
      return { passed: false, scanStatus: 'FAIL', issues }
    }

    // Size check removed (sizeBytes field doesn't exist in VaultAsset model)

    // MIME type verification (exact matching, not prefix)
    if (asset.mimeDetected) {
      const allowedMimes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/zip',
        'application/x-zip-compressed',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ]
      // Exact match required (not prefix match)
      if (!allowedMimes.includes(asset.mimeDetected)) {
        issues.push(`Suspicious or unsupported MIME type: ${asset.mimeDetected}`)
      }
    }
  }

  // License key validation
  if (asset.assetType === 'LICENSE_KEY') {
    if (!asset.encryptedData) {
      issues.push('License key data missing')
      return { passed: false, scanStatus: 'FAIL', issues }
    }
    // Basic format check (length, charset)
    // TODO: Add product-specific validation
  }

  // URL validation
  if (asset.assetType === 'URL') {
    if (!asset.url) {
      issues.push('URL missing')
      return { passed: false, scanStatus: 'FAIL', issues }
    }
    try {
      const urlObj = new URL(asset.url)
      // Validate protocol (must be http or https)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        issues.push('URL must use HTTP or HTTPS protocol')
        return { passed: false, scanStatus: 'FAIL', issues }
      }
    } catch {
      issues.push('Invalid URL format')
      return { passed: false, scanStatus: 'FAIL', issues }
    }
    // Block known shorteners unless allowlisted
    const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl']
    if (shorteners.some((s) => asset.url?.includes(s))) {
      issues.push('URL shortener detected (security risk)')
    }
    
    // Check URL accessibility (non-blocking, async)
    // This is done in quality checks to avoid blocking integrity checks
  }

  // Tracking number validation
  if (asset.assetType === 'TRACKING') {
    if (!asset.trackingNumber || asset.trackingNumber.length < 5) {
      issues.push('Invalid tracking number format')
      return { passed: false, scanStatus: 'FAIL', issues }
    }
  }

  // Virus/malware scan (placeholder - integrate with actual scanner)
  // For now, mark as PENDING and let background job handle
  const scanStatus = issues.length > 0 ? 'FAIL' : 'PENDING'

  return {
    passed: issues.length === 0,
    scanStatus,
    issues,
  }
}

/**
 * Step B: Proof Quality Checks (automatic, required)
 */
async function performQualityChecks(
  asset: VaultAsset
): Promise<{
  qualityScore: number
  metadata: VerificationResult['metadata']
  shouldRouteToReview: boolean
}> {
  let qualityScore = 100
  const metadata: VerificationResult['metadata'] = {
    issues: [],
  }

  // PDF/Document quality checks
  if (
    asset.assetType === 'FILE' &&
    asset.mimeDetected?.includes('pdf')
  ) {
    // Extract PDF metadata (simplified - in production use pdf-lib or similar)
    // For now, use stored metadata if available
    const storedMetadata = asset.metadataJson as any

    if (storedMetadata) {
      metadata.pageCount = storedMetadata.pageCount
      metadata.textLength = storedMetadata.textLength
      metadata.language = storedMetadata.language
      metadata.imageCount = storedMetadata.imageCount
      metadata.creationDate = storedMetadata.creationDate
        ? new Date(storedMetadata.creationDate)
        : undefined

      // Quality scoring
      if (metadata.pageCount === 0 || (metadata.textLength && metadata.textLength < 100)) {
        qualityScore -= 50
        metadata.issues.push('Document appears blank or has minimal content')
      }

      if (metadata.pageCount === 1 && metadata.textLength && metadata.textLength < 500) {
        qualityScore -= 30
        metadata.issues.push('Single page document with minimal text (possible junk)')
      }

      // Check for suspicious creation date
      if (metadata.creationDate) {
        const age = Date.now() - metadata.creationDate.getTime()
        const minutesAgo = age / (1000 * 60)
        if (minutesAgo < 10 && metadata.textLength && metadata.textLength < 1000) {
          qualityScore -= 20
          metadata.issues.push('Document created very recently with minimal content')
        }
      }

      // Check if image-only (unless acceptable)
      if (metadata.imageCount && metadata.imageCount > 0 && metadata.textLength && metadata.textLength < 50) {
        qualityScore -= 15
        metadata.issues.push('Document appears to be image-only with no text')
      }
    } else {
      // No metadata extracted - reduce score
      qualityScore -= 20
      metadata.issues.push('Could not extract document metadata')
    }
  }

  // License key quality
  if (asset.assetType === 'LICENSE_KEY') {
    // Check for duplicates across platform
    const duplicateCount = await prisma.vaultAsset.count({
      where: {
        sha256: asset.sha256,
        id: { not: asset.id },
      },
    })

    if (duplicateCount > 0) {
      qualityScore -= 40
      metadata.issues.push(`License key reused ${duplicateCount} time(s) across platform`)
    }
  }

  // URL quality
  if (asset.assetType === 'URL') {
    // Check if URL is accessible (non-blocking HEAD request)
    if (asset.url) {
      try {
        const urlObj = new URL(asset.url)
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          qualityScore -= 30
          metadata.issues.push('Invalid URL protocol')
        } else {
          // Try HEAD request to check accessibility (with timeout)
          // Use global fetch (available in Node.js 18+)
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
            
            const response = await fetch(asset.url, {
              method: 'HEAD',
              signal: controller.signal,
              redirect: 'follow',
            } as RequestInit)
            clearTimeout(timeoutId)
            
            if (!response.ok) {
              qualityScore -= 20
              metadata.issues.push(`URL returned status ${response.status}`)
            }
          } catch (fetchError: any) {
            // URL accessibility check failed - non-critical, just reduce quality score
            qualityScore -= 10
            metadata.issues.push('URL accessibility check failed - may be dead link')
          }
        }
      } catch (urlError) {
        qualityScore -= 30
        metadata.issues.push('Invalid URL format')
      }
    }
  }

  // Tracking quality
  if (asset.assetType === 'TRACKING') {
    // Enhanced format validation
    if (asset.trackingNumber) {
      const tracking = asset.trackingNumber.trim()
      
      // Length validation (most tracking numbers are 8-40 characters)
      if (tracking.length < 8 || tracking.length > 40) {
        qualityScore -= 20
        metadata.issues.push('Tracking number length suspicious (expected 8-40 characters)')
      }
      
      // Format validation (alphanumeric, hyphens, spaces allowed)
      if (!/^[A-Za-z0-9\-\s]+$/.test(tracking)) {
        qualityScore -= 15
        metadata.issues.push('Tracking number contains invalid characters')
      }
      
      // Check for common patterns (UPS, FedEx, USPS, DHL)
      const upsPattern = /^1Z[0-9A-Z]{16}$/i
      const fedexPattern = /^\d{12,14}$/
      const uspsPattern = /^[0-9]{20,22}$|^[A-Z]{2}[0-9]{9}[A-Z]{2}$/
      const dhlPattern = /^\d{10,11}$/
      
      const matchesPattern = upsPattern.test(tracking) || 
                            fedexPattern.test(tracking) || 
                            uspsPattern.test(tracking) || 
                            dhlPattern.test(tracking)
      
      if (!matchesPattern && tracking.length >= 8) {
        // Not a known pattern but has reasonable length - minor penalty
        qualityScore -= 5
        metadata.issues.push('Tracking number does not match known carrier format')
      }
    }
  }

  // Image quality checks (AI-powered for FILE and TICKET_PROOF types)
  if (
    (asset.assetType === 'FILE' || asset.assetType === 'TICKET_PROOF') &&
    asset.mimeDetected &&
    asset.mimeDetected.startsWith('image/') &&
    asset.storagePath
  ) {
    try {
      // Get the Rift to determine item type
      const rift = await prisma.riftTransaction.findUnique({
        where: { id: asset.riftId },
        select: { itemType: true },
      })
      
      if (rift) {
        // Get full Rift data for validation
        const fullRift = await prisma.riftTransaction.findUnique({
          where: { id: asset.riftId },
          select: {
            subtotal: true,
            currency: true,
            shippingAddress: true,
            itemType: true,
          },
        })
        
        // Use AI to analyze the image with Rift data for validation
        const aiAnalysis = await analyzeImageWithAI(
          asset, 
          rift.itemType as any,
          fullRift ? {
            subtotal: fullRift.subtotal,
            currency: fullRift.currency,
            shippingAddress: fullRift.shippingAddress,
            trackingNumber: null, // Could fetch from assets if needed
          } : undefined
        )
        
        // Store comprehensive AI analysis results in metadata
        metadata.aiAnalysis = {
          category: aiAnalysis.category,
          documentType: aiAnalysis.documentType,
          extractedText: aiAnalysis.extractedText?.substring(0, 2000), // Increased limit
          textConfidence: aiAnalysis.textConfidence,
          clarityScore: aiAnalysis.clarityScore,
          qualityIssues: aiAnalysis.qualityIssues,
          suspiciousElements: aiAnalysis.suspiciousElements,
          extractedData: aiAnalysis.extractedData,
          isScreenshot: aiAnalysis.isScreenshot,
          screenshotConfidence: aiAnalysis.screenshotConfidence,
          exifData: aiAnalysis.exifData,
          timestampAnalysis: aiAnalysis.timestampAnalysis,
          amountValidation: aiAnalysis.amountValidation,
          detectedBrands: aiAnalysis.detectedBrands,
          detectedLanguage: aiAnalysis.detectedLanguage,
        }
        
        // Update quality score based on AI analysis
        qualityScore = aiAnalysis.qualityScore
        
        // Add AI-detected issues to metadata
        if (!aiAnalysis.isRelevant) {
          metadata.issues.push(`Image does not match expected proof type for ${rift.itemType}`)
        }
        if (!aiAnalysis.isReadable) {
          metadata.issues.push('Image is not readable or clear enough')
        }
        if (aiAnalysis.qualityIssues.length > 0) {
          metadata.issues.push(`Image quality issues: ${aiAnalysis.qualityIssues.join(', ')}`)
        }
        if (!aiAnalysis.containsExpectedElements) {
          metadata.issues.push('Image does not contain expected elements for this transaction type')
        }
        if (aiAnalysis.suspiciousElements && aiAnalysis.suspiciousElements.length > 0) {
          metadata.issues.push(`Suspicious elements detected: ${aiAnalysis.suspiciousElements.join(', ')}`)
        }
        
        // Add validation issues
        if (aiAnalysis.amountValidation?.issues.length) {
          metadata.issues.push(...aiAnalysis.amountValidation.issues)
        }
        if (aiAnalysis.timestampAnalysis?.issues.length) {
          metadata.issues.push(...aiAnalysis.timestampAnalysis.issues)
        }
        
        // Flag screenshots and EXIF stripping
        if (aiAnalysis.isScreenshot) {
          metadata.issues.push('Image is a screenshot (original photo preferred)')
        }
        if (aiAnalysis.exifData?.wasStripped) {
          metadata.issues.push('EXIF metadata was stripped (may indicate manipulation)')
        }
        
        // Use AI's recommendation for routing to review
        const shouldRouteToReviewAI = aiAnalysis.shouldRouteToReview || qualityScore < 60
        
        return {
          qualityScore,
          metadata,
          shouldRouteToReview: shouldRouteToReviewAI,
        }
      }
    } catch (error: any) {
      console.error('AI image analysis failed, using fallback:', error)
      // Fallback to basic checks if AI fails
      metadata.issues.push('AI analysis unavailable - manual review recommended')
      qualityScore = 70 // Conservative score
    }
  }

  // Ensure quality score is between 0-100
  qualityScore = Math.max(0, Math.min(100, qualityScore))

  // Route to review if quality score is low
  const shouldRouteToReview = qualityScore < 60 || metadata.issues.length > 2

  return {
    qualityScore,
    metadata,
    shouldRouteToReview,
  }
}

/**
 * Main verification pipeline
 */
export async function verifyVaultAsset(assetId: string): Promise<VerificationResult> {
  const asset = await prisma.vaultAsset.findUnique({
    where: { id: assetId },
    include: { rift: true },
  })

  if (!asset) {
    throw new Error('Asset not found')
  }

  // Step A: Integrity & Safety
  const integrityResult = await performIntegrityChecks(asset)

  // Step B: Quality Checks (only if integrity passed)
  let qualityResult = {
    qualityScore: 0,
    metadata: { issues: [] as string[] },
    shouldRouteToReview: true,
  }

  if (integrityResult.passed) {
    qualityResult = await performQualityChecks(asset)
  }

  // Determine final status
  const passed = integrityResult.passed && qualityResult.qualityScore >= 60
  const scanStatus = integrityResult.scanStatus
  const shouldRouteToReview =
    !passed || qualityResult.shouldRouteToReview || integrityResult.issues.length > 0

  // AI Vault Asset Tagging
  let aiTags = null
  try {
    const { tagVaultAsset } = await import('@/lib/ai/vault-tagging')
    aiTags = await tagVaultAsset(asset, asset.rift.itemType)
    
    // Add tags to metadata
    if (qualityResult.metadata && aiTags) {
      qualityResult.metadata.aiTags = aiTags
    }
  } catch (error) {
    console.error('AI vault tagging failed:', error)
    // Continue without tags if tagging fails
  }

  // Update asset with results
  await prisma.vaultAsset.update({
    where: { id: assetId },
    data: {
      scanStatus,
      qualityScore: qualityResult.qualityScore,
      metadataJson: qualityResult.metadata,
    },
  })

  // Log verification completion
  await logVaultEvent({
    riftId: asset.riftId,
    assetId: asset.id,
    actorRole: 'SYSTEM',
    eventType: 'SYSTEM_QUALITY_CHECK_COMPLETED',
    metadata: {
      passed,
      qualityScore: qualityResult.qualityScore,
      scanStatus,
    },
  })

  return {
    passed,
    scanStatus,
    qualityScore: qualityResult.qualityScore,
    metadata: qualityResult.metadata,
    shouldRouteToReview,
    reasons: [...integrityResult.issues, ...qualityResult.metadata.issues],
  }
}

/**
 * Verify all assets for a Rift and determine if it should route to UNDER_REVIEW
 */
export async function verifyRiftProofs(riftId: string): Promise<{
  allPassed: boolean
  shouldRouteToReview: boolean
  results: VerificationResult[]
}> {
  const assets = await prisma.vaultAsset.findMany({
    where: { riftId },
  })

  const results: VerificationResult[] = []
  let allPassed = true
  let shouldRouteToReview = false

  for (const asset of assets) {
    const result = await verifyVaultAsset(asset.id)
    results.push(result)

    if (!result.passed) {
      allPassed = false
    }

    if (result.shouldRouteToReview) {
      shouldRouteToReview = true
    }
  }

  return {
    allPassed,
    shouldRouteToReview,
    results,
  }
}

/**
 * Check for duplicate content (same hash used across multiple Rifts)
 */
export async function checkDuplicateContent(sha256: string, uploaderId: string): Promise<{
  isDuplicate: boolean
  count: number
  riftIds: string[]
}> {
  const duplicates = await prisma.vaultAsset.findMany({
    where: {
      sha256,
      uploaderId,
    },
    select: {
      riftId: true,
    },
  })

  return {
    isDuplicate: duplicates.length > 1,
    count: duplicates.length,
    riftIds: duplicates.map((a) => a.riftId),
  }
}

