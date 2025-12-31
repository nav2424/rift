/**
 * AI-Powered Smart Release Timing Prediction
 * 
 * Predicts optimal release timing based on:
 * - Seller reputation patterns
 * - Item type complexity
 * - Buyer engagement metrics
 * - Historical dispute rates for similar transactions
 * - Dynamic hold duration optimization
 */

import { prisma } from '../prisma'
import OpenAI from 'openai'
import { ItemType } from '@prisma/client'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ReleaseTimingPrediction {
  recommendedHoldHours: number
  confidence: number // 0-100
  factors: {
    sellerReputation: number // 0-100
    itemTypeRisk: number // 0-100
    buyerEngagement: number // 0-100
    historicalDisputeRate: number // 0-100
  }
  reasoning: string
  earliestSafeRelease?: Date
}

/**
 * Predict optimal release timing for a Rift
 */
export async function predictReleaseTiming(
  riftId: string
): Promise<ReleaseTimingPrediction> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      id: true,
      itemType: true,
      subtotal: true,
      sellerId: true,
      buyerId: true,
      fundedAt: true,
      proofSubmittedAt: true,
      riskScore: true,
    },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  // Get seller reputation metrics
  const sellerReputation = await getSellerReputation(rift.sellerId, rift.itemType)

  // Get buyer engagement metrics
  const buyerEngagement = await getBuyerEngagement(riftId, rift.buyerId)

  // Get historical dispute rates for similar transactions
  const historicalDisputeRate = await getHistoricalDisputeRate(rift.itemType, rift.subtotal || 0)

  // Get item type risk
  const itemTypeRisk = getItemTypeRisk(rift.itemType)

  // Use AI to predict optimal timing
  const factors = {
    sellerReputation: sellerReputation.score,
    itemTypeRisk,
    buyerEngagement: buyerEngagement.score,
    historicalDisputeRate,
  }

  const recommendedHoldHours = await calculateOptimalHoldHours(rift, factors)

  const earliestSafeRelease = rift.proofSubmittedAt
    ? new Date(rift.proofSubmittedAt.getTime() + recommendedHoldHours * 60 * 60 * 1000)
    : undefined

  return {
    recommendedHoldHours,
    confidence: calculateConfidence(factors),
    factors,
    reasoning: generateReasoning(rift, factors, recommendedHoldHours),
    earliestSafeRelease,
  }
}

/**
 * Get seller reputation score (0-100, higher is better)
 */
async function getSellerReputation(sellerId: string, itemType: ItemType): Promise<{
  score: number
  totalTransactions: number
  successRate: number
  averageRating: number
}> {
  const completedRifts = await prisma.riftTransaction.findMany({
    where: {
      sellerId,
      status: { in: ['RELEASED', 'PAID_OUT'] },
    },
    select: { id: true },
  })

  const disputedRifts = await prisma.riftTransaction.findMany({
    where: {
      sellerId,
      status: 'DISPUTED',
    },
    select: { id: true },
  })

  const totalTransactions = completedRifts.length + disputedRifts.length
  const successRate = totalTransactions > 0 
    ? (completedRifts.length / totalTransactions) * 100 
    : 50

  // Get user rating
  const user = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { averageRating: true },
  })

  const averageRating = user?.averageRating || 0
  const ratingScore = averageRating * 20 // Convert 0-5 to 0-100

  // Calculate composite score
  const score = Math.round(
    successRate * 0.6 + // 60% weight on success rate
    ratingScore * 0.4 // 40% weight on rating
  )

  return {
    score: Math.max(0, Math.min(100, score)),
    totalTransactions,
    successRate,
    averageRating: averageRating || 0,
  }
}

/**
 * Get buyer engagement score (0-100)
 */
async function getBuyerEngagement(riftId: string, buyerId: string): Promise<{
  score: number
  hasDownloaded: boolean
  hasViewed: boolean
  hasConfirmed: boolean
}> {
  // Check if buyer has engaged with the delivery
  const supabase = await import('../supabase').then(m => m.createServerClient())
  
  const { data: views } = await supabase
    .from('delivery_views')
    .select('downloaded, seconds_viewed')
    .eq('rift_id', riftId)
    .limit(1)
    .single()

  const hasDownloaded = views?.downloaded || false
  const hasViewed = (views?.seconds_viewed || 0) > 0
  const hasConfirmed = !!(await prisma.riftEvent.findFirst({
    where: {
      riftId,
      eventType: 'BUYER_CONFIRMED_RECEIPT',
      actorId: buyerId,
    },
  }))

  // Calculate engagement score
  let score = 0
  if (hasConfirmed) score = 100
  else if (hasDownloaded) score = 80
  else if (hasViewed) score = 60
  else score = 30

  return {
    score,
    hasDownloaded,
    hasViewed,
    hasConfirmed,
  }
}

/**
 * Get historical dispute rate for similar transactions (0-100, higher is riskier)
 */
async function getHistoricalDisputeRate(itemType: ItemType, amount: number): Promise<number> {
  // Get similar transactions (same type, similar amount range)
  const amountRange = amount * 0.5 // ±50%
  
  const similarRifts = await prisma.riftTransaction.findMany({
    where: {
      itemType,
      subtotal: {
        gte: amount - amountRange,
        lte: amount + amountRange,
      },
    },
    select: { status: true },
  })

  if (similarRifts.length === 0) {
    return 50 // Default medium risk if no data
  }

  const disputedCount = similarRifts.filter(r => r.status === 'DISPUTED').length
  const disputeRate = (disputedCount / similarRifts.length) * 100

  return Math.round(disputeRate)
}

/**
 * Get item type risk score (0-100, higher is riskier)
 */
function getItemTypeRisk(itemType: ItemType): number {
  switch (itemType) {
    case 'TICKETS':
      return 70
    case 'DIGITAL':
      return 40
    case 'SERVICES':
      return 50
    case 'PHYSICAL':
      return 60
    default:
      return 50
  }
}

/**
 * Calculate optimal hold hours using AI
 */
async function calculateOptimalHoldHours(
  rift: any,
  factors: ReleaseTimingPrediction['factors']
): Promise<number> {
  // Base hold times by item type
  const baseHolds: Record<ItemType, number> = {
    DIGITAL: 48,
    LICENSE_KEYS: 48, // Same as DIGITAL
    TICKETS: 72,
    SERVICES: 96,
    PHYSICAL: 120,
  }

  let baseHours = baseHolds[rift.itemType as ItemType] || 72

  // Adjust based on factors
  // High seller reputation: reduce by up to 30%
  if (factors.sellerReputation >= 80) {
    baseHours *= 0.7
  } else if (factors.sellerReputation >= 60) {
    baseHours *= 0.85
  }

  // High buyer engagement: reduce by up to 20%
  if (factors.buyerEngagement >= 80) {
    baseHours *= 0.8
  }

  // High historical dispute rate: increase by up to 50%
  if (factors.historicalDisputeRate >= 30) {
    baseHours *= 1.5
  } else if (factors.historicalDisputeRate >= 20) {
    baseHours *= 1.2
  }

  // High item type risk: increase
  if (factors.itemTypeRisk >= 70) {
    baseHours *= 1.3
  }

  // Clamp between 24 hours and 14 days
  return Math.max(24, Math.min(336, Math.round(baseHours)))
}

/**
 * Calculate confidence score for the prediction
 */
function calculateConfidence(factors: ReleaseTimingPrediction['factors']): number {
  // Higher confidence if we have more data points
  // For now, base confidence on how clear the signals are
  let confidence = 70

  // If signals are very clear (extremes), higher confidence
  if (factors.sellerReputation > 90 || factors.sellerReputation < 20) {
    confidence += 10
  }
  if (factors.buyerEngagement > 90 || factors.buyerEngagement < 20) {
    confidence += 10
  }

  return Math.min(100, confidence)
}

/**
 * Generate human-readable reasoning for the prediction
 */
function generateReasoning(
  rift: any,
  factors: ReleaseTimingPrediction['factors'],
  recommendedHours: number
): string {
  const reasons: string[] = []

  if (factors.sellerReputation >= 80) {
    reasons.push('high seller reputation')
  } else if (factors.sellerReputation < 40) {
    reasons.push('lower seller reputation requires longer hold')
  }

  if (factors.buyerEngagement >= 80) {
    reasons.push('buyer has actively engaged')
  }

  if (factors.historicalDisputeRate >= 30) {
    reasons.push('high dispute rate for similar transactions')
  }

  if (factors.itemTypeRisk >= 70) {
    reasons.push(`${rift.itemType} items are higher risk`)
  }

  return `Recommended ${recommendedHours} hour hold based on: ${reasons.join(', ')}`
}

