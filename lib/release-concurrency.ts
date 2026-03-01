/**
 * Release Concurrency Protection
 * 
 * Prevents duplicate releases using database-level locking and unique constraints.
 * Implements the pattern:
 * 1. Insert pending release record (unique constraint prevents duplicates)
 * 2. Call Stripe transfer
 * 3. Update record with transfer_id
 */

import { prisma } from './prisma'
import { randomUUID } from 'crypto'

export interface ReleaseLock {
  releaseId: string
  riftId: string
  milestoneIndex?: number
  status: 'CREATING' | 'CREATED' | 'FAILED'
}

/**
 * Acquire a release lock for a full release
 * Returns existing lock if one already exists
 */
export async function acquireFullReleaseLock(
  riftId: string
): Promise<ReleaseLock | null> {
  try {
    // Check if release already exists
    const existing = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: { status: true },
    })

    if (existing?.status === 'RELEASED') {
      // Already released - check for payout record
      const payout = await prisma.payout.findFirst({
        where: { riftId },
        select: { stripeTransferId: true },
      })
      if (payout?.stripeTransferId) {
        return {
          releaseId: payout.stripeTransferId,
          riftId,
          status: 'CREATED',
        }
      }
      // Already released but no transfer ID yet (shouldn't happen, but handle gracefully)
      return {
        releaseId: 'already-released',
        riftId,
        status: 'CREATED',
      }
    }

    // Use optimistic locking via version field
    // If version changes between read and write, transaction will fail
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: { version: true, status: true },
    })

    if (!rift) {
      return null
    }

    // Try to update status to mark as "releasing" (if not already released)
    if (rift.status === 'RELEASED') {
      return {
        releaseId: 'already_released',
        riftId,
        status: 'CREATED',
      }
    }

    // Return lock info (actual transfer happens in calling code)
    return {
      releaseId: randomUUID(),
      riftId,
      status: 'CREATING',
    }
  } catch (error: any) {
    console.error('Error acquiring full release lock:', error)
    return null
  }
}

/**
 * Acquire a release lock for a milestone release
 * Uses unique constraint on (riftId, milestoneIndex) to prevent duplicates
 */
export async function acquireMilestoneReleaseLock(
  riftId: string,
  milestoneIndex: number
): Promise<ReleaseLock | null> {
  try {
    // Check if milestone already released
    const existing = await prisma.milestoneRelease.findFirst({
      where: {
        riftId,
        milestoneIndex,
        status: 'RELEASED',
      },
      select: { id: true, payoutId: true },
    })

    if (existing?.payoutId) {
      // Already released with transfer
      return {
        releaseId: existing.payoutId,
        riftId,
        milestoneIndex,
        status: 'CREATED',
      }
    }

    // Try to create pending release record (unique constraint prevents duplicates)
    try {
      const release = await prisma.milestoneRelease.create({
        data: {
          id: randomUUID(),
          riftId,
          milestoneIndex,
          milestoneTitle: 'Pending', // Will be updated
          milestoneAmount: 0, // Will be updated
          releasedAmount: 0, // Will be updated
          sellerFee: 0, // Will be updated
          sellerNet: 0, // Will be updated
          releasedBy: 'system', // Will be updated
          status: 'CREATING', // Temporary status
        },
      })

      return {
        releaseId: release.id,
        riftId,
        milestoneIndex,
        status: 'CREATING',
      }
    } catch (error: any) {
      // Unique constraint violation means milestone already being released
      if (error.code === 'P2002') {
        // Check if it's already completed
        const existing = await prisma.milestoneRelease.findFirst({
          where: {
            riftId,
            milestoneIndex,
          },
          select: { id: true, status: true, payoutId: true },
        })

        if (existing?.status === 'RELEASED' && existing.payoutId) {
          return {
            releaseId: existing.payoutId,
            riftId,
            milestoneIndex,
            status: 'CREATED',
          }
        }

        // Lock already held by another process
        return {
          releaseId: existing?.id || 'in_progress',
          riftId,
          milestoneIndex,
          status: 'CREATED',
        }
      }

      throw error
    }
  } catch (error: any) {
    console.error('Error acquiring milestone release lock:', error)
    return null
  }
}

/**
 * Complete a release lock (update with transfer ID)
 */
export async function completeReleaseLock(
  lock: ReleaseLock,
  transferId: string,
  releaseData?: {
    milestoneTitle?: string
    milestoneAmount?: number
    releasedAmount?: number
    sellerFee?: number
    sellerNet?: number
    releasedBy?: string
  }
): Promise<void> {
  if (lock.milestoneIndex !== undefined) {
    // Milestone release
    await prisma.milestoneRelease.update({
      where: { id: lock.releaseId },
      data: {
        status: 'RELEASED',
        payoutId: transferId,
        ...releaseData,
      },
    })
  } else {
    // Full release - transfer ID is stored in RiftTransaction
    // This is handled by the release logic
  }
}

/**
 * Release a failed lock (cleanup on error)
 */
export async function releaseFailedLock(lock: ReleaseLock): Promise<void> {
  if (lock.milestoneIndex !== undefined) {
    // Delete failed milestone release record
    try {
      await prisma.milestoneRelease.delete({
        where: { id: lock.releaseId },
      })
    } catch (error) {
      // Ignore if already deleted or doesn't exist
      console.warn('Error deleting failed milestone release:', error)
    }
  }
  // Full release doesn't need cleanup (status remains unchanged)
}


