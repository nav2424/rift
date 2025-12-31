/**
 * Enhanced Risk Scoring System
 * Combines buyer, seller, transaction, and behavioral factors
 */

import { prisma } from '../prisma'
import { computeUserRisk } from '../risk/computeRisk'
import { createServerClient } from '../supabase'

export interface EnhancedRiskFactors {
  buyerRisk: number
  sellerRisk: number
  transactionRisk: number
  behavioralRisk: number
  velocityRisk: number
  deviceRisk: number
  ipRisk: number
  anomalyScore: number
  overallRisk: number
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  recommendations: string[]
  flags: string[]
}

export interface VelocityMetrics {
  riftsLast24h: number
  riftsLast7d: number
  totalValueLast7d: number
  avgRiftValue: number
  velocitySpike: boolean
}

export interface DeviceFingerprint {
  deviceId?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}

/**
 * Compute enhanced risk score with all factors
 */
export async function computeEnhancedRiskScore(
  riftId: string,
  deviceFingerprint?: DeviceFingerprint
): Promise<EnhancedRiskFactors> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: {
      buyer: {
        select: {
          id: true,
          createdAt: true,
          emailVerified: true,
          phoneVerified: true,
        },
      },
      seller: {
        select: {
          id: true,
          createdAt: true,
          emailVerified: true,
          phoneVerified: true,
        },
      },
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  // 1. User Risk Scores
  const buyerRisk = await computeUserRisk(rift.buyerId, 'buyer')
  const sellerRisk = await computeUserRisk(rift.sellerId, 'seller')

  // 2. Transaction Risk
  const transactionRisk = computeTransactionRisk(rift)

  // 3. Behavioral Risk (velocity, patterns)
  const velocityMetrics = await computeVelocityMetrics(rift.buyerId, rift.sellerId)
  const behavioralRisk = computeBehavioralRisk(velocityMetrics, rift)

  // 4. Device & IP Risk
  const deviceRisk = deviceFingerprint
    ? await computeDeviceRisk(rift.buyerId, deviceFingerprint)
    : 0
  const ipRisk = deviceFingerprint
    ? await computeIPRisk(rift.buyerId, deviceFingerprint.ipAddress)
    : 0

  // 5. Anomaly Detection
  const anomalyScore = await detectAnomalies(rift, velocityMetrics)

  // 6. Combine all factors
  const overallRisk = Math.min(100, Math.round(
    buyerRisk * 0.25 +
    sellerRisk * 0.25 +
    transactionRisk * 0.20 +
    behavioralRisk * 0.15 +
    deviceRisk * 0.05 +
    ipRisk * 0.05 +
    anomalyScore * 0.05
  ))

  // 7. Determine risk tier
  const riskTier = overallRisk >= 80 ? 'CRITICAL' :
                   overallRisk >= 60 ? 'HIGH' :
                   overallRisk >= 40 ? 'MEDIUM' : 'LOW'

  // 8. Generate recommendations and flags
  const { recommendations, flags } = generateRecommendations({
    overallRisk,
    buyerRisk,
    sellerRisk,
    transactionRisk,
    behavioralRisk,
    velocityMetrics,
    deviceRisk,
    ipRisk,
    anomalyScore,
    rift,
  })

  return {
    buyerRisk,
    sellerRisk,
    transactionRisk,
    behavioralRisk,
    velocityRisk: behavioralRisk, // Alias
    deviceRisk,
    ipRisk,
    anomalyScore,
    overallRisk,
    riskTier,
    recommendations,
    flags,
  }
}

/**
 * Compute transaction-specific risk
 */
function computeTransactionRisk(rift: any): number {
  let risk = 0

  // Amount-based risk
  const amount = rift.subtotal || 0
  if (amount >= 1000) risk += 20
  else if (amount >= 500) risk += 10
  else if (amount >= 200) risk += 5

  // Category-based risk
  switch (rift.itemType) {
    case 'TICKETS':
      risk += 20
      break
    case 'DIGITAL':
      risk += 10
      break
    case 'SERVICES':
      risk += 5
      break
    case 'PHYSICAL':
      risk += 0
      break
  }

  // Account verification
  if (!rift.buyer.emailVerified || !rift.buyer.phoneVerified) {
    risk += 10
  }
  if (!rift.seller.emailVerified || !rift.seller.phoneVerified) {
    risk += 15
  }

  return Math.min(100, risk)
}

/**
 * Compute velocity metrics (spike detection)
 */
async function computeVelocityMetrics(
  buyerId: string,
  sellerId: string
): Promise<VelocityMetrics> {
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Buyer velocity
  const buyerRifts24h = await prisma.riftTransaction.count({
    where: {
      buyerId,
      createdAt: { gte: last24h },
    },
  })

  const buyerRifts7d = await prisma.riftTransaction.count({
    where: {
      buyerId,
      createdAt: { gte: last7d },
    },
  })

  const buyerRifts7dData = await prisma.riftTransaction.findMany({
    where: {
      buyerId,
      createdAt: { gte: last7d },
    },
    select: { subtotal: true },
  })

  const totalValueLast7d = buyerRifts7dData.reduce((sum, r) => sum + (r.subtotal || 0), 0)
  const avgRiftValue = buyerRifts7d > 0 ? totalValueLast7d / buyerRifts7d : 0

  // Seller velocity
  const sellerRifts24h = await prisma.riftTransaction.count({
    where: {
      sellerId,
      createdAt: { gte: last24h },
    },
  })

  const sellerRifts7d = await prisma.riftTransaction.count({
    where: {
      sellerId,
      createdAt: { gte: last7d },
    },
  })

  // Detect velocity spike (3x normal rate)
  const normalRate = buyerRifts7d / 7 // per day
  const velocitySpike = buyerRifts24h > normalRate * 3

  return {
    riftsLast24h: buyerRifts24h + sellerRifts24h,
    riftsLast7d: buyerRifts7d + sellerRifts7d,
    totalValueLast7d,
    avgRiftValue,
    velocitySpike,
  }
}

/**
 * Compute behavioral risk from velocity patterns
 */
function computeBehavioralRisk(
  velocity: VelocityMetrics,
  rift: any
): number {
  let risk = 0

  // Velocity spike
  if (velocity.velocitySpike) {
    risk += 15
  }

  // High volume in short time
  if (velocity.riftsLast24h >= 5) {
    risk += 10
  }

  // High value concentration
  if (velocity.totalValueLast7d >= 5000) {
    risk += 10
  }

  // Many buyers on one seller (potential scam)
  // This would need additional query - simplified here
  if (velocity.riftsLast7d >= 10) {
    risk += 5
  }

  return Math.min(100, risk)
}

/**
 * Compute device risk (device fingerprint reuse)
 */
async function computeDeviceRisk(
  userId: string,
  fingerprint: DeviceFingerprint
): Promise<number> {
  if (!fingerprint.deviceId) return 0

  let risk = 0

  // Check if device used by multiple accounts
  // This would require device tracking table - simplified here
  // In production, you'd query a device_fingerprints table

  // Check if device has been associated with disputes/chargebacks
  // Simplified - would need proper device history

  return Math.min(100, risk)
}

/**
 * Compute IP risk (IP address reuse, VPN detection)
 */
async function computeIPRisk(
  userId: string,
  ipAddress?: string
): Promise<number> {
  if (!ipAddress) return 0

  let risk = 0

  // Check if IP used by multiple accounts
  // This would require IP tracking - simplified here

  // Check for VPN/proxy (would need external service)
  // Simplified - assume 0 for now

  return Math.min(100, risk)
}

/**
 * Detect anomalies (sudden spikes, patterns)
 */
async function detectAnomalies(
  rift: any,
  velocity: VelocityMetrics
): Promise<number> {
  let score = 0

  // High-value spike
  if (velocity.velocitySpike && (rift.subtotal || 0) >= 500) {
    score += 20
  }

  // Many buyers on one seller (would need additional query)
  // Simplified - check seller's recent rifts
  const sellerRecentRifts = await prisma.riftTransaction.count({
    where: {
      sellerId: rift.sellerId,
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  })

  if (sellerRecentRifts >= 10) {
    score += 15 // Potential scam seller
  }

  // Repeated refund requests (would need dispute history)
  // Simplified for now

  return Math.min(100, score)
}

/**
 * Generate recommendations and flags
 */
function generateRecommendations(params: {
  overallRisk: number
  buyerRisk: number
  sellerRisk: number
  transactionRisk: number
  behavioralRisk: number
  velocityMetrics: VelocityMetrics
  deviceRisk: number
  ipRisk: number
  anomalyScore: number
  rift: any
}): { recommendations: string[]; flags: string[] } {
  const { overallRisk, buyerRisk, sellerRisk, velocityMetrics, rift } = params
  const recommendations: string[] = []
  const flags: string[] = []

  // Risk tier recommendations
  if (overallRisk >= 80) {
    recommendations.push('Require manual review before release')
    recommendations.push('Consider requiring 3DS authentication')
    recommendations.push('Extend hold period to 14 days')
    flags.push('CRITICAL_RISK')
  } else if (overallRisk >= 60) {
    recommendations.push('Require buyer confirmation before release')
    recommendations.push('Consider 3DS authentication')
    recommendations.push('Extend hold period to 7 days')
    flags.push('HIGH_RISK')
  } else if (overallRisk >= 40) {
    recommendations.push('Standard hold period (72 hours)')
    flags.push('MEDIUM_RISK')
  }

  // Buyer risk flags
  if (buyerRisk >= 60) {
    flags.push('HIGH_BUYER_RISK')
    recommendations.push('Buyer has high risk profile - monitor closely')
  }

  // Seller risk flags
  if (sellerRisk >= 60) {
    flags.push('HIGH_SELLER_RISK')
    recommendations.push('Seller has high risk profile - verify proof carefully')
  }

  // Velocity flags
  if (velocityMetrics.velocitySpike) {
    flags.push('VELOCITY_SPIKE')
    recommendations.push('Unusual transaction velocity detected - verify legitimacy')
  }

  // Transaction flags
  if ((rift.subtotal || 0) >= 1000) {
    flags.push('HIGH_VALUE')
    recommendations.push('High-value transaction - require additional verification')
  }

  if (rift.itemType === 'TICKETS') {
    flags.push('TICKET_CATEGORY')
    recommendations.push('Ticket transactions require extra verification')
  }

  return { recommendations, flags }
}

/**
 * Chargeback probability model
 * Predicts likelihood of Stripe disputes
 */
export async function predictChargebackProbability(
  riftId: string
): Promise<{
  probability: number // 0-100
  factors: string[]
  recommendation: 'LOW' | 'MEDIUM' | 'HIGH'
}> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: {
      buyer: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  let probability = 10 // Base 10%
  const factors: string[] = []

  // Check buyer's chargeback history
  const buyerChargebacks = await prisma.walletLedgerEntry.count({
    where: {
      walletAccount: {
        userId: rift.buyerId,
      },
      type: 'DEBIT_CHARGEBACK',
    },
  })

  if (buyerChargebacks > 0) {
    probability += buyerChargebacks * 15
    factors.push(`Buyer has ${buyerChargebacks} previous chargeback(s)`)
  }

  // Check buyer's dispute history
  // Get all rifts where buyer is the buyer
  const buyerRifts = await prisma.riftTransaction.findMany({
    where: {
      buyerId: rift.buyerId,
    },
    select: {
      id: true,
    },
  })

  const buyerRiftIds = buyerRifts.map(r => r.id)
  
  // Query disputes from Supabase
  let buyerDisputes = 0
  try {
    const supabase = createServerClient()
    if (buyerRiftIds.length > 0) {
      const { data: disputes, error } = await supabase
        .from('disputes')
        .select('id')
        .in('rift_id', buyerRiftIds)
        .eq('opened_by', rift.buyerId) // Only count disputes opened by the buyer
      
      if (!error && disputes) {
        buyerDisputes = disputes.length
      }
    }
  } catch (supabaseError) {
    // If Supabase is not configured, skip dispute count
    console.warn('Supabase not configured or error fetching disputes:', supabaseError)
  }

  if (buyerDisputes >= 3) {
    probability += 20
    factors.push(`Buyer has opened ${buyerDisputes} disputes`)
  }

  // High-value transactions more likely to chargeback
  if ((rift.subtotal || 0) >= 500) {
    probability += 10
    factors.push('High-value transaction')
  }

  // Ticket category higher risk
  if (rift.itemType === 'TICKETS') {
    probability += 15
    factors.push('Ticket category (higher chargeback risk)')
  }

  // New seller
  const sellerAccountAge = await prisma.user.findUnique({
    where: { id: rift.sellerId },
    select: { createdAt: true },
  })

  if (sellerAccountAge) {
    const ageDays = Math.floor(
      (Date.now() - sellerAccountAge.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (ageDays < 30) {
      probability += 10
      factors.push('New seller account (< 30 days)')
    }
  }

  probability = Math.min(100, probability)

  const recommendation: 'LOW' | 'MEDIUM' | 'HIGH' =
    probability >= 50 ? 'HIGH' :
    probability >= 30 ? 'MEDIUM' : 'LOW'

  return {
    probability,
    factors,
    recommendation,
  }
}

