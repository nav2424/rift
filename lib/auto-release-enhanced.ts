/**
 * Enhanced Auto-Release System
 * Implements access-based and time-based auto-release rules
 */

import { prisma } from './prisma'
import { calculateAutoReleaseDeadlineFromAccess, PROOF_DEADLINE_CONFIGS } from './proof-deadlines'
import { transitionRiftState } from './rift-state'
import { ItemType } from '@prisma/client'
import {
  normalizeMilestones,
  getNextUnreleasedMilestoneIndex,
  getMilestoneReviewWindowDays,
  calculateMilestoneAutoReleaseAt,
} from './milestone-utils'

/**
 * Get first buyer access timestamp for a Rift
 */
export async function getFirstBuyerAccess(riftId: string): Promise<Date | null> {
  const firstAccessEvent = await prisma.vault_events.findFirst({
    where: {
      riftId,
      actorRole: 'BUYER',
      eventType: {
        in: [
          'BUYER_OPENED_ASSET',
          'BUYER_DOWNLOADED_FILE',
          'BUYER_REVEALED_LICENSE_KEY',
          'BUYER_VIEWED_QR',
          'BUYER_VIEWED_TRACKING',
        ],
      },
    },
    orderBy: { timestampUtc: 'asc' },
    select: { timestampUtc: true },
  })
  
  return firstAccessEvent?.timestampUtc || null
}

/**
 * Recalculate auto-release deadline based on buyer access
 * Should be called whenever buyer accesses content
 */
export async function updateAutoReleaseDeadline(riftId: string): Promise<void> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      id: true,
      itemType: true,
      allowsPartialRelease: true,
      milestones: true,
      proofSubmittedAt: true,
      status: true,
    },
  })
  
  if (!rift || !rift.proofSubmittedAt || !['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(rift.status)) {
    return
  }
  
  // Milestone-based services: use milestone review windows
  if (rift.itemType === 'SERVICES' && rift.allowsPartialRelease && rift.milestones) {
    const milestones = normalizeMilestones(rift.milestones)
    const releases = await prisma.milestoneRelease.findMany({
      where: { riftId, status: 'RELEASED' },
      select: { milestoneIndex: true, status: true },
    })
    const nextIndex = getNextUnreleasedMilestoneIndex(milestones, releases)
    if (nextIndex !== null) {
      const reviewWindowDays = getMilestoneReviewWindowDays(milestones[nextIndex])
      const newDeadline = calculateMilestoneAutoReleaseAt(rift.proofSubmittedAt, reviewWindowDays)
      await prisma.riftTransaction.update({
        where: { id: riftId },
        data: {
          autoReleaseAt: newDeadline,
          autoReleaseScheduled: true,
        },
      })
    }
    return
  }

  // Get first buyer access
  const firstAccess = await getFirstBuyerAccess(riftId)
  
  if (!firstAccess) {
    return // No access yet, keep existing deadline
  }
  
  // Calculate new deadline based on access
  const newDeadline = calculateAutoReleaseDeadlineFromAccess(
    rift.itemType as ItemType,
    rift.proofSubmittedAt,
    firstAccess
  )
  
  if (newDeadline) {
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: {
        autoReleaseAt: newDeadline,
        autoReleaseScheduled: true,
      },
    })
  }
}

/**
 * Check if Rift is eligible for auto-release
 * Enhanced version that considers buyer access
 */
export async function checkAutoReleaseEligibility(riftId: string): Promise<{
  eligible: boolean
  reason?: string
  canAutoReleaseNow: boolean
  autoReleaseAt: Date | null
}> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: {
      Dispute: {
        where: { status: 'OPEN' },
      },
      Proof: {
        where: { status: 'VALID' },
        take: 1,
      },
      MilestoneRelease: {
        where: { status: 'RELEASED' },
      },
    },
  })
  
  if (!rift) {
    return { eligible: false, reason: 'Rift not found', canAutoReleaseNow: false, autoReleaseAt: null }
  }
  
  // Must be in valid state
  if (!['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(rift.status)) {
    return { eligible: false, reason: `Invalid state: ${rift.status}`, canAutoReleaseNow: false, autoReleaseAt: null }
  }
  
  // Must have valid proof
  if (rift.Proof.length === 0) {
    return { eligible: false, reason: 'No valid proof', canAutoReleaseNow: false, autoReleaseAt: null }
  }
  
  // No open disputes
  if (rift.Dispute.length > 0) {
    return { eligible: false, reason: 'Open dispute exists', canAutoReleaseNow: false, autoReleaseAt: null }
  }
  
  // Milestone-based services: use milestone review windows
  if (rift.itemType === 'SERVICES' && rift.allowsPartialRelease && rift.milestones) {
    const milestones = normalizeMilestones(rift.milestones)
    const nextIndex = getNextUnreleasedMilestoneIndex(milestones, rift.MilestoneRelease)
    if (nextIndex === null) {
      return { eligible: false, reason: 'All milestones released', canAutoReleaseNow: false, autoReleaseAt: null }
    }

    const reviewWindowDays = getMilestoneReviewWindowDays(milestones[nextIndex])
    const computedDeadline = rift.proofSubmittedAt
      ? calculateMilestoneAutoReleaseAt(rift.proofSubmittedAt, reviewWindowDays)
      : null

    if (!rift.autoReleaseAt && computedDeadline) {
      await prisma.riftTransaction.update({
        where: { id: riftId },
        data: {
          autoReleaseAt: computedDeadline,
          autoReleaseScheduled: true,
        },
      })
    }

    const deadline = rift.autoReleaseAt || computedDeadline
    if (!deadline) {
      return { eligible: false, reason: 'Auto-release deadline not set', canAutoReleaseNow: false, autoReleaseAt: null }
    }

    const now = new Date()
    return {
      eligible: true,
      canAutoReleaseNow: now >= deadline,
      autoReleaseAt: deadline,
    }
  }

  // Check auto-release deadline
  if (!rift.autoReleaseAt) {
    // Calculate deadline if not set
    if (rift.proofSubmittedAt) {
      const firstAccess = await getFirstBuyerAccess(riftId)
      const deadline = calculateAutoReleaseDeadlineFromAccess(
        rift.itemType as ItemType,
        rift.proofSubmittedAt,
        firstAccess
      )
      
      if (deadline) {
        await prisma.riftTransaction.update({
          where: { id: riftId },
          data: {
            autoReleaseAt: deadline,
            autoReleaseScheduled: true,
          },
        })
        
        return {
          eligible: true,
          canAutoReleaseNow: false,
          autoReleaseAt: deadline,
        }
      }
    }
    
    return { eligible: false, reason: 'Auto-release deadline not set', canAutoReleaseNow: false, autoReleaseAt: null }
  }
  
  const now = new Date()
  const canAutoReleaseNow = now >= rift.autoReleaseAt
  
  // Special rule: If buyer has accessed content, auto-release can happen sooner
  const firstAccess = await getFirstBuyerAccess(riftId)
  const config = PROOF_DEADLINE_CONFIGS[rift.itemType as ItemType]
  
  if (firstAccess && config && config.autoReleaseAfterAccessHours) {
    const accessBasedDeadline = new Date(
      firstAccess.getTime() + config.autoReleaseAfterAccessHours * 60 * 60 * 1000
    )
    
    if (now >= accessBasedDeadline) {
      return {
        eligible: true,
        reason: 'Buyer accessed content and access-based deadline passed',
        canAutoReleaseNow: true,
        autoReleaseAt: accessBasedDeadline,
      }
    }
  }
  
  return {
    eligible: true,
    canAutoReleaseNow,
    autoReleaseAt: rift.autoReleaseAt,
  }
}

/**
 * Process auto-release for a single Rift
 */
export async function processAutoRelease(riftId: string): Promise<{ success: boolean; error?: string }> {
  const eligibility = await checkAutoReleaseEligibility(riftId)
  
  if (!eligibility.eligible) {
    return { success: false, error: eligibility.reason }
  }
  
  if (!eligibility.canAutoReleaseNow) {
    return { success: false, error: `Auto-release scheduled for ${eligibility.autoReleaseAt?.toISOString()}` }
  }
  
  try {
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: { itemType: true, allowsPartialRelease: true, milestones: true },
    })

    if (rift?.itemType === 'SERVICES' && rift.allowsPartialRelease && rift.milestones) {
      const { releaseMilestone } = await import('./milestone-release')
      const milestones = normalizeMilestones(rift.milestones)
      const releases = await prisma.milestoneRelease.findMany({
        where: { riftId, status: 'RELEASED' },
        select: { milestoneIndex: true, status: true },
      })
      const nextIndex = getNextUnreleasedMilestoneIndex(milestones, releases)
      if (nextIndex === null) {
        return { success: false, error: 'All milestones already released' }
      }
      await releaseMilestone({
        riftId,
        milestoneIndex: nextIndex,
        releasedById: null,
        actorType: 'SYSTEM',
        allowedStatuses: ['PROOF_SUBMITTED', 'UNDER_REVIEW'],
        requireBuyer: false,
        requireProofAfterLastRelease: nextIndex > 0,
        allowPendingProof: false,
        autoRelease: true,
      })
    } else {
      await transitionRiftState(riftId, 'RELEASED', {
        reason: 'Auto-release: Buyer accessed content and deadline passed',
      })
    }
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
