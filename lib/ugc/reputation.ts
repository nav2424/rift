/**
 * UGC reputation metrics: behavioral rollups for creator and brand (no star ratings).
 */

import { prisma } from '@/lib/prisma'

export interface CreatorMetrics {
  on_time_delivery_rate: number
  dispute_rate: number
  avg_response_time_ms: number | null
  revision_requests_per_deal: number
}

export interface BrandMetrics {
  approval_speed_avg_ms: number | null
  dispute_rate: number
  revision_friction_score: number
  cancellation_rate: number
}

function emptyCreatorMetrics(): CreatorMetrics {
  return {
    on_time_delivery_rate: 0,
    dispute_rate: 0,
    avg_response_time_ms: null,
    revision_requests_per_deal: 0,
  }
}

function emptyBrandMetrics(): BrandMetrics {
  return {
    approval_speed_avg_ms: null,
    dispute_rate: 0,
    revision_friction_score: 0,
    cancellation_rate: 0,
  }
}

/** Compute and store reputation rollup for a user in a role (CREATOR or BRAND). */
export async function computeAndStoreReputationRollup(userId: string, role: 'CREATOR' | 'BRAND'): Promise<void> {
  const now = new Date()
  if (role === 'CREATOR') {
    const metrics = await computeCreatorMetrics(userId)
    await prisma.reputationRollup.upsert({
      where: { userId_role: { userId, role: 'CREATOR' } },
      create: {
        id: crypto.randomUUID(),
        userId,
        role: 'CREATOR',
        metricsJson: metrics as unknown as object,
        updatedAt: now,
      },
      update: { metricsJson: metrics as unknown as object, updatedAt: now },
    })
  } else {
    const metrics = await computeBrandMetrics(userId)
    await prisma.reputationRollup.upsert({
      where: { userId_role: { userId, role: 'BRAND' } },
      create: {
        id: crypto.randomUUID(),
        userId,
        role: 'BRAND',
        metricsJson: metrics as unknown as object,
        updatedAt: now,
      },
      update: { metricsJson: metrics as unknown as object, updatedAt: now },
    })
  }
}

async function computeCreatorMetrics(userId: string): Promise<CreatorMetrics> {
  const rifts = await prisma.riftTransaction.findMany({
    where: { sellerId: userId },
    include: {
      Milestone: {
        include: {
          MilestoneDelivery: true,
          MilestoneRevision: true,
          Dispute: true,
        },
      },
    },
  })

  let onTime = 0
  let totalDeliveries = 0
  let totalRevisions = 0
  let disputeCount = 0
  const responseTimes: number[] = []

  for (const rift of rifts) {
    for (const m of rift.Milestone) {
      const delivery = m.MilestoneDelivery[0]
      if (delivery) {
        totalDeliveries++
        if (m.dueAt && new Date(delivery.createdAt) <= m.dueAt) onTime++
      }
      totalRevisions += m.MilestoneRevision.length
      if (m.Dispute.length > 0) disputeCount++
    }
  }

  const completedDeals = rifts.filter((r) => r.status === 'RELEASED' || r.status === 'PAID_OUT').length
  const disputeRate = rifts.length > 0 ? disputeCount / rifts.length : 0
  const revisionPerDeal = rifts.length > 0 ? totalRevisions / rifts.length : 0

  return {
    on_time_delivery_rate: totalDeliveries > 0 ? onTime / totalDeliveries : 0,
    dispute_rate: disputeRate,
    avg_response_time_ms: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : null,
    revision_requests_per_deal: revisionPerDeal,
  }
}

async function computeBrandMetrics(userId: string): Promise<BrandMetrics> {
  const rifts = await prisma.riftTransaction.findMany({
    where: { buyerId: userId },
    include: {
      Milestone: {
        include: {
          MilestoneDelivery: true,
          MilestoneRevision: true,
          Dispute: true,
        },
      },
    },
  })

  const approvalDeltas: number[] = []
  let totalMilestones = 0
  let revisionCount = 0
  let disputeCount = 0
  let canceled = 0

  for (const rift of rifts) {
    if (rift.status === 'CANCELED' || rift.status === 'CANCELLED') canceled++
    for (const m of rift.Milestone) {
      totalMilestones++
      if (m.MilestoneRevision.length > 0) revisionCount++
      if (m.Dispute.length > 0) disputeCount++
      const delivery = m.MilestoneDelivery[0]
      if (delivery && m.approvedAt) {
        approvalDeltas.push(new Date(m.approvedAt).getTime() - new Date(delivery.createdAt).getTime())
      }
    }
  }

  const disputeRate = rifts.length > 0 ? disputeCount / rifts.length : 0
  const revisionFriction = totalMilestones > 0 ? revisionCount / totalMilestones : 0
  const cancellationRate = rifts.length > 0 ? canceled / rifts.length : 0

  return {
    approval_speed_avg_ms: approvalDeltas.length > 0 ? approvalDeltas.reduce((a, b) => a + b, 0) / approvalDeltas.length : null,
    dispute_rate: disputeRate,
    revision_friction_score: revisionFriction,
    cancellation_rate: cancellationRate,
  }
}

export async function getReputationRollup(userId: string, role: 'CREATOR' | 'BRAND'): Promise<CreatorMetrics | BrandMetrics | null> {
  const row = await prisma.reputationRollup.findUnique({
    where: { userId_role: { userId, role } },
  })
  if (!row) return null
  return row.metricsJson as CreatorMetrics | BrandMetrics
}
