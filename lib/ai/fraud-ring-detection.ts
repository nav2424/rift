/**
 * Fraud Ring Detection
 * Clusters accounts by device/IP/payment patterns
 */

import { prisma } from '../prisma'

export interface FraudRing {
  ringId: string
  accounts: string[]
  confidence: number
  patterns: string[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface BehavioralTrustScore {
  userId: string
  score: number // 0-100
  factors: {
    consistentUsage: number
    normalTiming: number
    noAnomalies: number
    accountAge: number
  }
  recommendation: 'TRUSTED' | 'REVIEW' | 'RESTRICT'
}

/**
 * Detect fraud rings by clustering accounts
 */
export async function detectFraudRings(
  userId: string
): Promise<FraudRing[]> {
  // This would require device/IP tracking tables
  // Simplified implementation - would need:
  // - device_fingerprints table
  // - ip_addresses table
  // - payment_patterns table

  const rings: FraudRing[] = []

  // Check for shared devices
  // Check for shared IPs
  // Check for payment pattern similarities

  return rings
}

/**
 * Compute behavioral trust score
 */
export async function computeBehavioralTrustScore(
  userId: string
): Promise<BehavioralTrustScore> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
    },
  })

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // Account age
  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  )
  const accountAgeScore = Math.min(100, accountAgeDays * 2) // 50 days = 100

  // Consistent usage (check transaction history)
  const rifts = await prisma.riftTransaction.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Check for consistent timing (not all at once)
  const consistentUsage = rifts.length >= 5 ? 80 : rifts.length >= 2 ? 50 : 20

  // Normal timing (spread out, not all in one day)
  const timingSpread = rifts.length > 1
    ? calculateTimingSpread(rifts.map(r => r.createdAt))
    : 50
  const normalTiming = timingSpread

  // No anomalies (would check for velocity spikes, etc.)
  const noAnomalies = 80 // Simplified

  const score = Math.round(
    (accountAgeScore * 0.3) +
    (consistentUsage * 0.25) +
    (normalTiming * 0.25) +
    (noAnomalies * 0.2)
  )

  const recommendation: 'TRUSTED' | 'REVIEW' | 'RESTRICT' =
    score >= 70 ? 'TRUSTED' :
    score >= 50 ? 'REVIEW' : 'RESTRICT'

  return {
    userId,
    score,
    factors: {
      consistentUsage,
      normalTiming,
      noAnomalies,
      accountAge: accountAgeScore,
    },
    recommendation,
  }
}

function calculateTimingSpread(dates: Date[]): number {
  if (dates.length < 2) return 50

  const sorted = dates.sort((a, b) => a.getTime() - b.getTime())
  const intervals: number[] = []

  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].getTime() - sorted[i - 1].getTime()
    const hours = diff / (1000 * 60 * 60)
    intervals.push(hours)
  }

  // Check if intervals are spread out (not all within 24 hours)
  const allWithin24h = intervals.every(h => h < 24)
  if (allWithin24h) return 30 // Suspicious

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  return Math.min(100, avgInterval / 24 * 100) // More spread = higher score
}

/**
 * Get verification recommendations based on risk
 */
export async function getVerificationRecommendations(
  riftId: string
): Promise<{
  require3DS: boolean
  requirePhoneVerification: boolean
  requireManualReview: boolean
  reasoning: string[]
}> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      riskScore: true,
      subtotal: true,
      itemType: true,
      buyerId: true,
      sellerId: true,
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  const reasoning: string[] = []
  let require3DS = false
  let requirePhoneVerification = false
  let requireManualReview = false

  // High risk score
  if (rift.riskScore >= 70) {
    require3DS = true
    requirePhoneVerification = true
    reasoning.push('High risk score detected')
  }

  // High value
  if ((rift.subtotal || 0) >= 1000) {
    require3DS = true
    reasoning.push('High-value transaction')
  }

  // Tickets category
  if (rift.itemType === 'TICKETS') {
    require3DS = true
    requirePhoneVerification = true
    reasoning.push('Ticket category requires extra verification')
  }

  // Critical risk
  if (rift.riskScore >= 80) {
    requireManualReview = true
    reasoning.push('Critical risk - manual review required')
  }

  return {
    require3DS,
    requirePhoneVerification,
    requireManualReview,
    reasoning,
  }
}

