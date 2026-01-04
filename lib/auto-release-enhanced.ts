/**
 * Enhanced Auto-Release System
 * Implements access-based and time-based auto-release rules
 */

import { prisma } from './prisma'
import { calculateAutoReleaseDeadlineFromAccess, PROOF_DEADLINE_CONFIGS } from './proof-deadlines'
import { transitionRiftState } from './rift-state'
import { ItemType } from '@prisma/client'

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
      proofSubmittedAt: true,
      status: true,
    },
  })
  
  if (!rift || !rift.proofSubmittedAt || !['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(rift.status)) {
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
    await transitionRiftState(riftId, 'RELEASED', {
      reason: 'Auto-release: Buyer accessed content and deadline passed',
    })
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
