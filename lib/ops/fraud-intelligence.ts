/**
 * Fraud Intelligence Dashboard
 * Top fraud patterns, churn prediction, support copilot
 */

import { prisma } from '../prisma'
import { createServerClient } from '../supabase'

export interface FraudPattern {
  pattern: string
  frequency: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  affectedRifts: number
  description: string
}

export interface ChurnPrediction {
  userId: string
  churnProbability: number // 0-100
  factors: string[]
  recommendedActions: string[]
}

/**
 * Get top fraud patterns for dashboard
 */
export async function getTopFraudPatterns(
  days: number = 7
): Promise<FraudPattern[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const patterns: FraudPattern[] = []

  // Pattern 1: Duplicate proof reuse
  const duplicateProofs = await prisma.vaultAsset.groupBy({
    by: ['sha256'],
    where: {
      createdAt: { gte: since },
    },
    _count: {
      id: true,
    },
    having: {
      id: {
        _count: {
          gt: 1,
        },
      },
    },
  })

  if (duplicateProofs.length > 0) {
    patterns.push({
      pattern: 'DUPLICATE_PROOF_REUSE',
      frequency: duplicateProofs.length,
      riskLevel: 'HIGH',
      affectedRifts: duplicateProofs.reduce((sum, p) => sum + p._count.id, 0),
      description: 'Same proof file used across multiple transactions',
    })
  }

  // Pattern 2: High dispute rate sellers
  // Query disputes from Supabase and group by rift_id
  let sellersWithDisputes: Array<{ rift_id: string; count: number }> = []
  try {
    const supabase = createServerClient()
    const { data: disputes, error } = await supabase
      .from('disputes')
      .select('rift_id, created_at')
      .gte('created_at', since.toISOString())
    
    if (!error && disputes) {
      // Group by rift_id and count
      const disputeCounts = new Map<string, number>()
      disputes.forEach(dispute => {
        const count = disputeCounts.get(dispute.rift_id) || 0
        disputeCounts.set(dispute.rift_id, count + 1)
      })
      
      // Filter for rifts with more than 2 disputes
      sellersWithDisputes = Array.from(disputeCounts.entries())
        .filter(([_, count]) => count > 2)
        .map(([rift_id, count]) => ({ rift_id, count }))
    }
  } catch (supabaseError) {
    // If Supabase is not configured, skip this pattern
    console.warn('Supabase not configured or error fetching disputes:', supabaseError)
  }

  if (sellersWithDisputes.length > 0) {
    patterns.push({
      pattern: 'HIGH_DISPUTE_SELLERS',
      frequency: sellersWithDisputes.length,
      riskLevel: 'MEDIUM',
      affectedRifts: sellersWithDisputes.length,
      description: 'Sellers with 3+ disputes in period',
    })
  }

  // Pattern 3: Velocity spikes
  // Would need to query for users with sudden spike in transactions
  // Simplified for now

  // Pattern 4: Chargeback patterns
  const chargebacks = await prisma.walletLedgerEntry.count({
    where: {
      type: 'DEBIT_CHARGEBACK',
      createdAt: { gte: since },
    },
  })

  if (chargebacks > 0) {
    patterns.push({
      pattern: 'CHARGEBACK_SPIKE',
      frequency: chargebacks,
      riskLevel: 'CRITICAL',
      affectedRifts: chargebacks,
      description: `${chargebacks} chargeback(s) in period`,
    })
  }

  return patterns.sort((a, b) => {
    const riskOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
    return riskOrder[b.riskLevel] - riskOrder[a.riskLevel]
  })
}

/**
 * Predict user churn
 */
export async function predictChurn(
  userId: string
): Promise<ChurnPrediction> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
    },
  })

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // Get user activity
  const recentRifts = await prisma.riftTransaction.count({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  })

  const olderRifts = await prisma.riftTransaction.count({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      createdAt: {
        gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  })

  // Check for negative experiences
  // Get all rifts where user is buyer or seller
  const userRifts = await prisma.riftTransaction.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    select: {
      id: true,
    },
  })

  const userRiftIds = userRifts.map(r => r.id)
  
  // Query disputes from Supabase
  let disputes = 0
  try {
    const supabase = createServerClient()
    if (userRiftIds.length > 0) {
      const { data: disputeData, error } = await supabase
        .from('disputes')
        .select('id')
        .in('rift_id', userRiftIds)
      
      if (!error && disputeData) {
        disputes = disputeData.length
      }
    }
  } catch (supabaseError) {
    // If Supabase is not configured, skip dispute count
    console.warn('Supabase not configured or error fetching disputes:', supabaseError)
  }

  const chargebacks = await prisma.walletLedgerEntry.count({
    where: {
      walletAccount: { userId },
      type: 'DEBIT_CHARGEBACK',
    },
  })

  // Calculate churn probability
  let probability = 10 // Base 10%

  // Declining activity
  if (recentRifts < olderRifts * 0.5 && olderRifts > 0) {
    probability += 30
  }

  // No activity in 30 days but had activity before
  if (recentRifts === 0 && olderRifts > 0) {
    probability += 40
  }

  // Negative experiences
  if (disputes >= 2) {
    probability += 20
  }

  if (chargebacks > 0) {
    probability += 30
  }

  probability = Math.min(100, probability)

  const factors: string[] = []
  if (recentRifts < olderRifts * 0.5) {
    factors.push('Declining transaction activity')
  }
  if (recentRifts === 0 && olderRifts > 0) {
    factors.push('No activity in last 30 days')
  }
  if (disputes >= 2) {
    factors.push(`Multiple disputes (${disputes})`)
  }
  if (chargebacks > 0) {
    factors.push(`Chargeback(s) occurred`)
  }

  const recommendedActions: string[] = []
  if (probability >= 50) {
    recommendedActions.push('Send retention email with incentives')
    recommendedActions.push('Offer support to resolve issues')
  }
  if (disputes > 0) {
    recommendedActions.push('Follow up on dispute resolution')
  }

  return {
    userId,
    churnProbability: probability,
    factors,
    recommendedActions,
  }
}

/**
 * Support copilot - answer tickets using policies and history
 */
export async function supportCopilot(
  question: string,
  userId?: string,
  riftId?: string
): Promise<{
  answer: string
  confidence: number
  sources: string[]
  suggestedActions: string[]
}> {
  // Simplified - would use AI/ML in production
  const answer = 'Based on Rift policies and your transaction history...'
  const confidence = 75
  const sources: string[] = ['Rift Terms of Service', 'Transaction History']
  const suggestedActions: string[] = []

  // Context-aware responses
  if (riftId) {
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: { status: true, itemType: true },
    })

    if (rift) {
      if (rift.status === 'DISPUTED') {
        sources.push('Dispute Resolution Policy')
        suggestedActions.push('Review dispute details', 'Contact support if needed')
      }
    }
  }

  return {
    answer,
    confidence,
    sources,
    suggestedActions,
  }
}

