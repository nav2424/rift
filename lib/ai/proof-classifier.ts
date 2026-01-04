/**
 * AI Proof Classifier
 * Detects if upload matches item type and validates authenticity
 */

import { prisma } from '../prisma'

export interface ProofClassification {
  itemTypeMatch: boolean
  confidence: number // 0-100
  detectedType: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES' | 'UNKNOWN'
  authenticitySignals: AuthenticitySignal[]
  qualityScore: number // 0-100
  warnings: string[]
  recommendations: string[]
}

export interface AuthenticitySignal {
  type: 'METADATA_MATCH' | 'TEMPLATE_DETECTED' | 'BLANK_DOCUMENT' | 'LOW_QUALITY' | 'MISMATCH'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  confidence: number
}

/**
 * Classify proof asset and validate against item type
 */
export async function classifyProof(
  assetId: string,
  expectedItemType: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES'
): Promise<ProofClassification> {
  const asset = await prisma.vault_assets.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      assetType: true,
      fileName: true,
      mimeDetected: true,
      sha256: true,
      textContent: true,
      metadataJson: true,
    },
  })

  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`)
  }

  // Detect item type from file
  const detectedType = detectItemTypeFromAsset(asset)
  const itemTypeMatch = detectedType === expectedItemType

  // Check authenticity signals
  const authenticitySignals = await checkAuthenticitySignals(asset, expectedItemType)

  // Calculate quality score
  const qualityScore = calculateQualityScore(asset, authenticitySignals)

  // Generate warnings and recommendations
  const warnings: string[] = []
  const recommendations: string[] = []

  if (!itemTypeMatch) {
    warnings.push(`Uploaded file type (${detectedType}) does not match expected type (${expectedItemType})`)
    recommendations.push('Please upload proof that matches the item type')
  }

  const criticalSignals = authenticitySignals.filter(s => s.severity === 'CRITICAL' || s.severity === 'HIGH')
  if (criticalSignals.length > 0) {
    warnings.push(...criticalSignals.map(s => s.message))
    recommendations.push('Proof may be invalid - manual review recommended')
  }

  if (qualityScore < 50) {
    warnings.push('Proof quality is low - may not be sufficient')
    recommendations.push('Please provide higher quality proof')
  }

  // Calculate confidence
  const confidence = itemTypeMatch && qualityScore >= 70 ? 90 :
                     itemTypeMatch && qualityScore >= 50 ? 70 :
                     itemTypeMatch ? 50 :
                     qualityScore >= 70 ? 40 :
                     qualityScore >= 50 ? 30 : 20

  return {
    itemTypeMatch,
    confidence,
    detectedType,
    authenticitySignals,
    qualityScore,
    warnings,
    recommendations,
  }
}

/**
 * Detect item type from asset metadata and content
 */
function detectItemTypeFromAsset(asset: any): 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES' | 'UNKNOWN' {
  const fileName = (asset.fileName || '').toLowerCase()
  const mimeType = asset.mimeType || ''
  const textContent = asset.textContent || ''

  // Ticket detection
  if (
    fileName.includes('ticket') ||
    fileName.includes('event') ||
    textContent.includes('ticket') ||
    textContent.includes('event') ||
    textContent.includes('venue') ||
    textContent.includes('seat')
  ) {
    return 'TICKETS'
  }

  // Digital goods detection
  if (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType === 'application/pdf' ||
    fileName.endsWith('.pdf') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.mp4')
  ) {
    // Could be digital or service proof
    if (textContent.includes('deliverable') || textContent.includes('completed')) {
      return 'SERVICES'
    }
    return 'DIGITAL'
  }

  // Service detection
  if (
    textContent.includes('service') ||
    textContent.includes('deliverable') ||
    textContent.includes('completed') ||
    textContent.includes('milestone')
  ) {
    return 'SERVICES'
  }

  // Physical detection (tracking numbers, shipping)
  if (
    textContent.includes('tracking') ||
    textContent.includes('shipping') ||
    textContent.includes('delivery') ||
    textContent.includes('carrier')
  ) {
    return 'PHYSICAL'
  }

  return 'UNKNOWN'
}

/**
 * Check authenticity signals (low-effort fakes, templates, etc.)
 */
async function checkAuthenticitySignals(
  asset: any,
  expectedType: string
): Promise<AuthenticitySignal[]> {
  const signals: AuthenticitySignal[] = []

  // Check for blank/empty documents
  if (asset.fileSize && asset.fileSize < 1000) {
    signals.push({
      type: 'BLANK_DOCUMENT',
      severity: 'HIGH',
      message: 'File size is very small - may be blank or empty',
      confidence: 80,
    })
  }

  // Check for template reuse (would need perceptual hashing - simplified)
  // In production, compare SHA-256 against known templates
  const duplicateCheck = await prisma.vault_assets.findFirst({
    where: {
      sha256: asset.sha256,
      id: { not: asset.id },
    },
  })

  if (duplicateCheck) {
    signals.push({
      type: 'TEMPLATE_DETECTED',
      severity: 'CRITICAL',
      message: 'This exact file has been used in another transaction',
      confidence: 100,
    })
  }

  // Check metadata mismatch (if we have expected metadata)
  // Simplified - would need more sophisticated metadata extraction

  // Check for low quality (very small images, etc.)
  if (asset.mimeType?.startsWith('image/') && asset.fileSize && asset.fileSize < 50000) {
    signals.push({
      type: 'LOW_QUALITY',
      severity: 'MEDIUM',
      message: 'Image file is very small - may be low quality',
      confidence: 70,
    })
  }

  return signals
}

/**
 * Calculate proof quality score
 */
function calculateQualityScore(
  asset: any,
  signals: AuthenticitySignal[]
): number {
  let score = 100

  // Deduct for authenticity issues
  for (const signal of signals) {
    switch (signal.severity) {
      case 'CRITICAL':
        score -= 40
        break
      case 'HIGH':
        score -= 25
        break
      case 'MEDIUM':
        score -= 15
        break
      case 'LOW':
        score -= 5
        break
    }
  }

  // Deduct for missing metadata
  if (!asset.fileName) score -= 10
  if (!asset.mimeType) score -= 10
  if (!asset.textContent && asset.mimeType?.includes('text')) score -= 20

  return Math.max(0, Math.min(100, score))
}

/**
 * Extract ticket information from proof
 */
export async function extractTicketInfo(
  assetId: string
): Promise<{
  eventName?: string
  eventDate?: string
  venue?: string
  matches: boolean
  mismatches: string[]
}> {
  const asset = await prisma.vault_assets.findUnique({
    where: { id: assetId },
    select: {
      textContent: true,
      fileName: true,
    },
  })

  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`)
  }

  const text = (asset.textContent || asset.fileName || '').toLowerCase()
  const mismatches: string[] = []

  // Simple extraction (in production, use OCR/ML)
  const eventNameMatch = text.match(/(?:event|concert|show):\s*([^\n,]+)/i)
  const eventName = eventNameMatch ? eventNameMatch[1].trim() : undefined

  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)
  const eventDate = dateMatch ? dateMatch[1] : undefined

  const venueMatch = text.match(/(?:venue|location|at):\s*([^\n,]+)/i)
  const venue = venueMatch ? venueMatch[1].trim() : undefined

  return {
    eventName,
    eventDate,
    venue,
    matches: true, // Would compare against rift fields
    mismatches,
  }
}

/**
 * Validate service completion deliverables
 */
export async function validateServiceDeliverables(
  riftId: string,
  assetIds: string[]
): Promise<{
  valid: boolean
  missing: string[]
  found: string[]
  qualityScore: number
}> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      serviceDeliverables: true,
      completionCriteria: true,
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  const deliverables = rift.serviceDeliverables
    ? (typeof rift.serviceDeliverables === 'string'
        ? JSON.parse(rift.serviceDeliverables)
        : rift.serviceDeliverables)
    : []

  const criteria = rift.completionCriteria || ''

  const assets = await prisma.vault_assets.findMany({
    where: { id: { in: assetIds } },
    select: {
      id: true,
      fileName: true,
      textContent: true,
      assetType: true,
    },
  })

  const found: string[] = []
  const missing: string[] = []

  // Check for required deliverables
  for (const deliverable of deliverables) {
    const foundDeliverable = assets.some(asset => {
      const fileName = (asset.fileName || '').toLowerCase()
      const text = (asset.textContent || '').toLowerCase()
      const deliverableLower = deliverable.toLowerCase()
      return fileName.includes(deliverableLower) || text.includes(deliverableLower)
    })

    if (foundDeliverable) {
      found.push(deliverable)
    } else {
      missing.push(deliverable)
    }
  }

  // Calculate quality score
  const qualityScore = deliverables.length > 0
    ? (found.length / deliverables.length) * 100
    : assets.length > 0 ? 70 : 0

  return {
    valid: missing.length === 0 && assets.length > 0,
    missing,
    found,
    qualityScore,
  }
}

