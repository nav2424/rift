/**
 * Dynamic Rules Engine
 * AI-driven policy with adaptive thresholds
 */

import { prisma } from '../prisma'

export interface AdaptiveThresholds {
  category: string
  riskThreshold: number
  holdWindowDays: number
  require3DS: boolean
  requireManualReview: boolean
  lastUpdated: Date
}

export interface SmartRequirements {
  mandatoryFields: string[]
  recommendedFields: string[]
  proofRequirements: {
    minAssets: number
    requiredTypes: string[]
  }
}

/**
 * Get adaptive thresholds based on live dispute rates
 */
export async function getAdaptiveThresholds(
  category: 'PHYSICAL' | 'DIGITAL_GOODS' | 'OWNERSHIP_TRANSFER' | 'SERVICES'
): Promise<AdaptiveThresholds> {
  // Calculate dispute rate for this category
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const totalRifts = await prisma.riftTransaction.count({
    where: {
      itemType: category,
      createdAt: { gte: thirtyDaysAgo },
    },
  })

  const disputedRifts = await prisma.riftTransaction.count({
    where: {
      itemType: category,
      status: 'DISPUTED',
      createdAt: { gte: thirtyDaysAgo },
    },
  })

  const disputeRate = totalRifts > 0 ? disputedRifts / totalRifts : 0

  // Adjust thresholds based on dispute rate
  let riskThreshold = 50 // Default
  let holdWindowDays = 3 // Default
  let require3DS = false
  let requireManualReview = false

  if (disputeRate > 0.15) {
    // High dispute rate - tighten rules
    riskThreshold = 40
    holdWindowDays = 7
    require3DS = true
    requireManualReview = disputeRate > 0.25
  } else if (disputeRate > 0.10) {
    // Medium dispute rate
    riskThreshold = 45
    holdWindowDays = 5
    require3DS = true
  } else if (disputeRate < 0.05) {
    // Low dispute rate - relax rules
    riskThreshold = 60
    holdWindowDays = 2
  }

  // Category-specific adjustments
  if (category === 'OWNERSHIP_TRANSFER') {
    riskThreshold = Math.min(riskThreshold, 40) // Always stricter for ownership transfer
    holdWindowDays = Math.max(holdWindowDays, 5)
    require3DS = true
  }

  return {
    category,
    riskThreshold,
    holdWindowDays,
    require3DS,
    requireManualReview,
    lastUpdated: new Date(),
  }
}

/**
 * Get smart requirements for a rift scenario
 */
export async function getSmartRequirements(
  riftId: string
): Promise<SmartRequirements> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      itemType: true,
      subtotal: true,
      riskScore: true,
      serviceDeliverables: true,
      completionCriteria: true,
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  const mandatoryFields: string[] = ['itemTitle', 'itemDescription']
  const recommendedFields: string[] = []

  // Type-specific requirements
  if (rift.itemType === 'OWNERSHIP_TRANSFER') {
    mandatoryFields.push('eventDate', 'venue')
    recommendedFields.push('seatNumber', 'section')
  }

  if (rift.itemType === 'SERVICES') {
    mandatoryFields.push('serviceDeliverables', 'completionCriteria')
  }

  // Risk-based requirements
  if (rift.riskScore >= 60) {
    recommendedFields.push('additionalVerification')
  }

  // Value-based requirements
  if ((rift.subtotal || 0) >= 500) {
    recommendedFields.push('detailedDescription', 'deliveryTimeline')
  }

  // Proof requirements
  const proofRequirements = {
    minAssets: rift.itemType === 'SERVICES' ? 2 : 1,
    requiredTypes: rift.itemType === 'OWNERSHIP_TRANSFER' ? ['IMAGE', 'PDF'] :
                   rift.itemType === 'SERVICES' ? ['IMAGE', 'TEXT', 'LINK'] :
                   ['ANY'],
  }

  return {
    mandatoryFields,
    recommendedFields,
    proofRequirements,
  }
}

/**
 * Calculate real-time hold window based on risk
 */
export async function calculateHoldWindow(
  riftId: string
): Promise<{
  holdUntil: Date
  reasoning: string
}> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      itemType: true,
      riskScore: true,
      subtotal: true,
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  // Get adaptive thresholds
  const itemTypeForThresholds = rift.itemType
  const thresholds = await getAdaptiveThresholds(itemTypeForThresholds as 'PHYSICAL' | 'DIGITAL_GOODS' | 'OWNERSHIP_TRANSFER' | 'SERVICES')

  // Calculate hold window
  let holdDays = thresholds.holdWindowDays

  // Adjust based on risk score
  if (rift.riskScore >= 80) {
    holdDays = 14
  } else if (rift.riskScore >= 60) {
    holdDays = 7
  } else if (rift.riskScore >= 40) {
    holdDays = 5
  }

  // High value = longer hold
  if ((rift.subtotal || 0) >= 1000) {
    holdDays = Math.max(holdDays, 7)
  }

  const holdUntil = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000)

  const reasoning = `Hold period: ${holdDays} days (risk score: ${rift.riskScore}, category: ${rift.itemType})`

  return {
    holdUntil,
    reasoning,
  }
}

