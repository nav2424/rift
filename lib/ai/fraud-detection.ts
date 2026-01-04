/**
 * AI-Powered Fraud Detection and Enhanced Risk Scoring
 * 
 * Uses ML models and pattern analysis to detect:
 * - Coordinated fraud (multiple accounts from same source)
 * - Anomalous transaction patterns
 * - Device fingerprint analysis
 * - IP geolocation anomalies
 * - Behavioral patterns
 */

import { prisma } from '../prisma'
import OpenAI from 'openai'
import { createHash } from 'crypto'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface FraudSignals {
  coordinatedFraudRisk: number // 0-100
  deviceFingerprintRisk: number // 0-100
  ipGeolocationRisk: number // 0-100
  behavioralAnomalyRisk: number // 0-100
  transactionPatternRisk: number // 0-100
  overallFraudScore: number // 0-100 (weighted average)
  reasons: string[]
  recommendedAction: 'allow' | 'review' | 'block'
}

export interface DeviceFingerprint {
  userAgent?: string
  deviceFingerprint?: string
  screenResolution?: string
  timezone?: string
  language?: string
  platform?: string
}

/**
 * Generate a device fingerprint hash from available data
 */
function generateDeviceFingerprint(data: DeviceFingerprint): string {
  const components = [
    data.userAgent || '',
    data.screenResolution || '',
    data.timezone || '',
    data.language || '',
    data.platform || '',
  ]
  const combined = components.join('|')
  return createHash('sha256').update(combined).digest('hex').substring(0, 32)
}

/**
 * Check for coordinated fraud - multiple accounts using same device/IP patterns
 */
async function detectCoordinatedFraud(
  userId: string,
  deviceFingerprint?: string,
  ipHash?: string
): Promise<{ risk: number; reasons: string[] }> {
  const reasons: string[] = []
  let risk = 0

  if (!deviceFingerprint && !ipHash) {
    return { risk: 0, reasons }
  }

  // Check for other users with same device fingerprint
  if (deviceFingerprint) {
    const eventsWithSameDevice = await prisma.rift_events.findMany({
      where: {
        deviceFingerprint,
        actorId: { not: userId },
      },
      select: { actorId: true },
      distinct: ['actorId'],
    })

    const uniqueUsers = new Set(eventsWithSameDevice.map(e => e.actorId).filter(Boolean))
    
    if (uniqueUsers.size > 0) {
      risk += Math.min(uniqueUsers.size * 15, 60) // Max 60 points for device sharing
      reasons.push(`${uniqueUsers.size} other user(s) have used this device`)
    }
  }

  // Check for accounts created from same IP within short timeframe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  })

  if (user && ipHash) {
    // This is simplified - in production, you'd store IP hashes in a separate table
    // For now, we'll check vault events which store ipHash
    const recentAccounts = await prisma.vault_events.findMany({
      where: {
        ipHash,
        timestampUtc: {
          gte: new Date(user.createdAt.getTime() - 24 * 60 * 60 * 1000), // 24 hours
        },
        actorId: { not: userId },
      },
      select: { actorId: true },
      distinct: ['actorId'],
    })

    const uniqueAccounts = new Set(recentAccounts.map(e => e.actorId).filter(Boolean))
    
    if (uniqueAccounts.size >= 3) {
      risk += 40
      reasons.push(`${uniqueAccounts.size} accounts created from same IP within 24 hours`)
    } else if (uniqueAccounts.size >= 2) {
      risk += 20
      reasons.push(`${uniqueAccounts.size} accounts created from same IP within 24 hours`)
    }
  }

  return { risk: Math.min(risk, 100), reasons }
}

/**
 * Analyze transaction patterns for anomalies
 */
async function analyzeTransactionPatterns(
  userId: string,
  role: 'buyer' | 'seller',
  currentAmount: number,
  currentItemType: string
): Promise<{ risk: number; reasons: string[] }> {
  const reasons: string[] = []
  let risk = 0

  // Get user's transaction history
  const transactions = await prisma.riftTransaction.findMany({
    where: role === 'buyer' ? { buyerId: userId } : { sellerId: userId },
    select: {
      subtotal: true,
      itemType: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  if (transactions.length === 0) {
    // New user - moderate risk
    risk += 10
    reasons.push('New user with no transaction history')
    return { risk, reasons }
  }

  // Check for sudden spike in transaction amount
  const avgAmount = transactions.reduce((sum, t) => sum + (t.subtotal || 0), 0) / transactions.length
  if (currentAmount > avgAmount * 3 && transactions.length >= 3) {
    risk += 30
    reasons.push(`Transaction amount ($${currentAmount}) is 3x higher than average ($${avgAmount.toFixed(2)})`)
  }

  // Check for rapid transaction frequency
  if (transactions.length >= 5) {
    const recent5 = transactions.slice(0, 5)
    const timeSpan = recent5[0].createdAt.getTime() - recent5[4].createdAt.getTime()
    const hours = timeSpan / (1000 * 60 * 60)
    
    if (hours < 24) {
      risk += 25
      reasons.push(`5 transactions in less than 24 hours (possible bot activity)`)
    }
  }

  // Check for item type switching (digital -> tickets -> services rapidly)
  if (transactions.length >= 3) {
    const recentTypes = transactions.slice(0, 3).map(t => t.itemType)
    const uniqueTypes = new Set(recentTypes)
    if (uniqueTypes.size === 3) {
      risk += 15
      reasons.push('Rapid switching between different item types')
    }
  }

  // Check for failed/canceled transaction pattern
  const failedCount = transactions.filter(t => 
    t.status === 'CANCELED' || t.status === 'REFUNDED'
  ).length
  const failureRate = failedCount / transactions.length
  
  if (failureRate > 0.5 && transactions.length >= 5) {
    risk += 35
    reasons.push(`High failure rate (${(failureRate * 100).toFixed(0)}% of transactions failed/canceled)`)
  }

  return { risk: Math.min(risk, 100), reasons }
}

/**
 * Analyze IP geolocation for anomalies
 */
async function analyzeIPGeolocation(
  ipAddress: string,
  userId: string
): Promise<{ risk: number; reasons: string[] }> {
  const reasons: string[] = []
  let risk = 0

  // Get user's location history from events
  const userEvents = await prisma.rift_events.findMany({
    where: { actorId: userId },
    select: { ipHash: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Check for VPN/Proxy indicators (simplified - in production, use a service like MaxMind)
  // For now, we'll check if IP changes frequently (potential VPN/proxy)
  if (userEvents.length >= 5) {
    const uniqueIPs = new Set(userEvents.map(e => e.ipHash).filter(Boolean))
    if (uniqueIPs.size >= 5) {
      risk += 20
      reasons.push('Frequent IP address changes (possible VPN/proxy usage)')
    }
  }

  // In production, integrate with MaxMind GeoIP2 or similar service
  // to check for:
  // - IP in high-risk country
  // - IP in data center (VPN/proxy)
  // - IP geolocation mismatch with user's stated location

  return { risk: Math.min(risk, 100), reasons }
}

/**
 * Analyze behavioral patterns using AI
 */
async function analyzeBehavioralPatterns(
  userId: string,
  transactionContext: {
    itemType: string
    amount: number
    description: string
    timeOfDay: number // Hour of day
  }
): Promise<{ risk: number; reasons: string[] }> {
  const reasons: string[] = []
  let risk = 0

  // Get user's transaction patterns
  const transactions = await prisma.riftTransaction.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    select: {
      itemType: true,
      subtotal: true,
      createdAt: true,
      itemDescription: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  if (transactions.length === 0) {
    return { risk: 0, reasons }
  }

  // Analyze transaction timing patterns
  const transactionHours = transactions.map(t => new Date(t.createdAt).getHours())
  const avgHour = transactionHours.reduce((sum, h) => sum + h, 0) / transactionHours.length
  const currentHour = transactionContext.timeOfDay
  
  // Check if transaction is at unusual time (more than 4 hours from average)
  if (Math.abs(currentHour - avgHour) > 4 && transactions.length >= 5) {
    risk += 15
    reasons.push(`Transaction at unusual time (${currentHour}:00 vs average ${avgHour.toFixed(1)}:00)`)
  }

  // Use AI to analyze description patterns
  if (transactionContext.description) {
    try {
      const descriptions = transactions.map(t => t.itemDescription || '').filter(Boolean).slice(0, 5)
      
      const prompt = `Analyze these transaction descriptions for a user and determine if the new description follows similar patterns or seems suspiciously different:

Previous descriptions:
${descriptions.map((d, i) => `${i + 1}. ${d.substring(0, 100)}`).join('\n')}

New description:
${transactionContext.description.substring(0, 200)}

Respond with a JSON object:
{
  "similarityScore": 0-100,
  "suspicious": boolean,
  "reason": "brief explanation"
}`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a fraud detection system. Analyze transaction descriptions for behavioral patterns.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      })

      const analysis = JSON.parse(completion.choices[0].message.content || '{}')
      
      if (analysis.suspicious) {
        risk += 30
        reasons.push(`Description pattern anomaly: ${analysis.reason || 'Unusual description pattern'}`)
      }
    } catch (error) {
      console.error('Behavioral pattern analysis failed:', error)
      // Fail silently - don't block transactions due to AI errors
    }
  }

  return { risk: Math.min(risk, 100), reasons }
}

/**
 * Main fraud detection function
 */
export async function detectFraud(
  userId: string,
  transactionData: {
    amount: number
    itemType: string
    itemDescription: string
    role: 'buyer' | 'seller'
  },
  requestMeta?: {
    ip?: string
    userAgent?: string
    deviceFingerprint?: string
  }
): Promise<FraudSignals> {
  const reasons: string[] = []
  const timeOfDay = new Date().getHours()

  // 1. Coordinated fraud detection
  const deviceFp = requestMeta?.deviceFingerprint || generateDeviceFingerprint({
    userAgent: requestMeta?.userAgent,
  })
  const ipHash = requestMeta?.ip ? createHash('sha256').update(requestMeta.ip + (process.env.IP_HASH_SALT || '')).digest('hex') : undefined
  
  const coordinatedFraud = await detectCoordinatedFraud(userId, deviceFp, ipHash)
  reasons.push(...coordinatedFraud.reasons)

  // 2. Device fingerprint risk (simplified - check for common suspicious patterns)
  let deviceRisk = 0
  if (!requestMeta?.deviceFingerprint && !requestMeta?.userAgent) {
    deviceRisk = 20
    reasons.push('Missing device fingerprint information')
  }

  // 3. IP geolocation analysis
  const ipRisk = requestMeta?.ip 
    ? await analyzeIPGeolocation(requestMeta.ip, userId)
    : { risk: 0, reasons: [] }
  reasons.push(...ipRisk.reasons)

  // 4. Behavioral pattern analysis
  const behavioralRisk = await analyzeBehavioralPatterns(userId, {
    itemType: transactionData.itemType,
    amount: transactionData.amount,
    description: transactionData.itemDescription,
    timeOfDay,
  })
  reasons.push(...behavioralRisk.reasons)

  // 5. Transaction pattern analysis
  const patternRisk = await analyzeTransactionPatterns(
    userId,
    transactionData.role,
    transactionData.amount,
    transactionData.itemType
  )
  reasons.push(...patternRisk.reasons)

  // Calculate weighted overall fraud score
  const overallFraudScore = Math.round(
    coordinatedFraud.risk * 0.30 +
    deviceRisk * 0.15 +
    ipRisk.risk * 0.15 +
    behavioralRisk.risk * 0.20 +
    patternRisk.risk * 0.20
  )

  // Determine recommended action
  let recommendedAction: 'allow' | 'review' | 'block' = 'allow'
  if (overallFraudScore >= 70) {
    recommendedAction = 'block'
  } else if (overallFraudScore >= 40) {
    recommendedAction = 'review'
  }

  return {
    coordinatedFraudRisk: coordinatedFraud.risk,
    deviceFingerprintRisk: deviceRisk,
    ipGeolocationRisk: ipRisk.risk,
    behavioralAnomalyRisk: behavioralRisk.risk,
    transactionPatternRisk: patternRisk.risk,
    overallFraudScore,
    reasons: [...new Set(reasons)], // Remove duplicates
    recommendedAction,
  }
}

/**
 * Enhanced risk scoring that combines rule-based and AI-based signals
 */
export async function computeEnhancedRiskScore(
  userId: string,
  riftId: string,
  baseRiskScore: number,
  fraudSignals?: FraudSignals
): Promise<{
  enhancedRiskScore: number
  fraudSignals: FraudSignals
  riskAdjustment: number
}> {
  // If fraud signals not provided, compute them
  if (!fraudSignals) {
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        subtotal: true,
        itemType: true,
        itemDescription: true,
        buyerId: true,
        sellerId: true,
      },
    })

    if (!rift) {
      throw new Error('Rift not found')
    }

    const role = rift.buyerId === userId ? 'buyer' : 'seller'
    
    fraudSignals = await detectFraud(userId, {
      amount: rift.subtotal || 0,
      itemType: rift.itemType,
      itemDescription: rift.itemDescription,
      role,
    })
  }

  // Adjust base risk score based on fraud signals
  // Fraud score of 0-40: reduce risk by up to 10 points (trustworthy user)
  // Fraud score of 40-70: increase risk by 10-30 points (review needed)
  // Fraud score of 70+: increase risk by 30-50 points (high risk)
  
  let riskAdjustment = 0
  if (fraudSignals.overallFraudScore < 40) {
    riskAdjustment = -Math.round((fraudSignals.overallFraudScore / 40) * 10)
  } else if (fraudSignals.overallFraudScore >= 70) {
    riskAdjustment = 30 + Math.round(((fraudSignals.overallFraudScore - 70) / 30) * 20)
  } else {
    riskAdjustment = 10 + Math.round(((fraudSignals.overallFraudScore - 40) / 30) * 20)
  }

  const enhancedRiskScore = Math.max(0, Math.min(100, baseRiskScore + riskAdjustment))

  return {
    enhancedRiskScore,
    fraudSignals,
    riskAdjustment,
  }
}

