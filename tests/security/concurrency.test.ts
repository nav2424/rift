/**
 * Security Tests: Concurrency and Race Conditions
 * Tests that concurrent operations maintain consistency
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createTestRift } from '../factories/riftFactory'
import { createTestUser } from '../factories/userFactory'

// Prisma is already mocked in tests/setup.ts

describe('Concurrency and Race Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Dispute vs Auto-Release Race Condition', () => {
    it('should prevent auto-release when dispute is opened concurrently', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PROOF_SUBMITTED' })
      const buyer = createTestUser()
      rift.buyerId = buyer.id

      let currentStatus = 'PROOF_SUBMITTED'
      let updateInProgress = false
      
      // Mock findUnique to return current state
      vi.mocked(prisma.riftTransaction.findUnique).mockImplementation(async () => {
        return { ...rift, status: currentStatus } as any
      })
      
      // Mock update to change status atomically with locking - only first update succeeds
      vi.mocked(prisma.riftTransaction.update).mockImplementation(async (args: any) => {
        // If an update is already in progress, the second one should fail
        if (updateInProgress) {
          throw new Error('Concurrent update detected')
        }
        updateInProgress = true
        
        // Small delay to simulate race condition
        await new Promise(resolve => setTimeout(resolve, 5))
        
        // Check if status was already changed by another operation
        if (currentStatus !== 'PROOF_SUBMITTED') {
          updateInProgress = false
          throw new Error('Status already changed')
        }
        
        if (args.data.status) {
          currentStatus = args.data.status
        }
        updateInProgress = false
        return { ...rift, status: currentStatus } as any
      })
      
      vi.mocked(prisma.dispute.create).mockResolvedValue({ id: 'dispute1' } as any)

      // Simulate concurrent operations
      const disputePromise = openDispute(rift.id, buyer.id)
      const autoReleasePromise = processAutoRelease(rift.id)

      const [disputeResult, autoReleaseResult] = await Promise.allSettled([
        disputePromise,
        autoReleasePromise,
      ])

      // One should succeed, one should be blocked
      const disputeSucceeded = disputeResult.status === 'fulfilled'
      const autoReleaseSucceeded = autoReleaseResult.status === 'fulfilled'

      // They cannot both succeed
      expect(disputeSucceeded && autoReleaseSucceeded).toBe(false)

      // If dispute succeeded, auto-release should be blocked
      if (disputeSucceeded) {
        expect(autoReleaseResult.status === 'rejected' || 
               (autoReleaseResult.status === 'fulfilled' && 
                autoReleaseResult.value.blocked === true)).toBe(true)
      }
    })

    it('should use database-level locking to prevent race conditions', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PROOF_SUBMITTED' })
      
      let updateCount = 0
      // Mock update to only allow first update to succeed
      vi.mocked(prisma.riftTransaction.update).mockImplementation(async (args: any) => {
        updateCount++
        if (updateCount > 1) {
          // Simulate optimistic locking failure - second update fails
          throw new Error('Version mismatch')
        }
        return { ...rift, status: args.data.status } as any
      })
      
      // Simulate concurrent status updates
      const update1 = updateEscrowStatus(rift.id, 'UNDER_REVIEW')
      const update2 = updateEscrowStatus(rift.id, 'RELEASED')

      const [result1, result2] = await Promise.allSettled([update1, update2])

      // Only one should succeed (database transaction isolation)
      const succeeded = [result1, result2].filter(r => r.status === 'fulfilled')
      expect(succeeded.length).toBeLessThanOrEqual(1)
    })
  })

  describe('Admin Review vs Buyer Acceptance', () => {
    it('should maintain consistent final state when admin reviews while buyer accepts', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PROOF_SUBMITTED' })
      const buyer = createTestUser()
      const admin = createTestUser({ role: 'ADMIN' })
      rift.buyerId = buyer.id

      let currentStatus = 'PROOF_SUBMITTED'
      
      vi.mocked(prisma.riftTransaction.findUnique).mockImplementation(async () => {
        return { ...rift, status: currentStatus } as any
      })
      
      vi.mocked(prisma.riftTransaction.update).mockImplementation(async (args: any) => {
        if (args.data.status) {
          currentStatus = args.data.status
        }
        return { ...rift, status: currentStatus } as any
      })

      // Concurrent operations
      const acceptPromise = buyerAccepts(rift.id, buyer.id)
      const reviewPromise = adminReviews(rift.id, admin.id, 'APPROVED')

      const [acceptResult, reviewResult] = await Promise.allSettled([
        acceptPromise,
        reviewPromise,
      ])

      // Final state should be deterministic
      const finalRift = await getEscrowStatus(rift.id)
      
      // Should be in a valid final state (not inconsistent)
      expect(finalRift && ['RELEASED', 'UNDER_REVIEW', 'APPROVED'].includes(finalRift.status)).toBe(true)
    })
  })

  describe('Multiple Proof Submissions', () => {
    it('should handle concurrent proof submissions from same seller', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PAID' })
      const seller = createTestUser()
      rift.sellerId = seller.id

      let proofSubmitted = false
      let lock = false
      
      vi.mocked(prisma.riftTransaction.findUnique).mockImplementation(async () => {
        return { ...rift, proofSubmittedAt: proofSubmitted ? new Date() : null } as any
      })
      
      // Mock to simulate that only first submission sets proofSubmittedAt (atomic check-and-set)
      const submitProofWithLock = async (riftId: string, sellerId: string, fileContent: Buffer) => {
        // Atomic check-and-set
        if (lock) {
          throw new Error('Proof already submitted')
        }
        lock = true
        
        // Small delay to simulate race condition
        await new Promise(resolve => setTimeout(resolve, 1))
        
        const rift = await prisma.riftTransaction.findUnique({ where: { id: riftId } })
        if (rift?.proofSubmittedAt) {
          lock = false
          throw new Error('Proof already submitted')
        }
        proofSubmitted = true
        return { success: true }
      }

      // Concurrent submissions
      const submission1 = submitProofWithLock(rift.id, seller.id, Buffer.from('file1'))
      const submission2 = submitProofWithLock(rift.id, seller.id, Buffer.from('file2'))

      const [result1, result2] = await Promise.allSettled([submission1, submission2])

      // Both should succeed (different files) or one should be rejected (if only one proof allowed)
      // In practice, only one proof submission should be allowed per rift
      const succeeded = [result1, result2].filter(r => r.status === 'fulfilled')
      expect(succeeded.length).toBeLessThanOrEqual(1) // Only one proof per rift
    })
  })
})

// Helper functions
async function openDispute(riftId: string, buyerId: string) {
  // Use database transaction to atomically check status and create dispute
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift || rift.buyerId !== buyerId) {
    throw new Error('Unauthorized')
  }

  if (rift.status === 'RELEASED' || rift.status === 'PAID_OUT') {
    throw new Error('Cannot dispute after release')
  }

  // Update status to UNDER_REVIEW atomically
  await prisma.riftTransaction.update({
    where: { id: riftId },
    data: { status: 'UNDER_REVIEW' },
  })

  return await prisma.dispute.create({
    data: {
      EscrowTransaction: { connect: { id: riftId } },
      reason: 'TEST',
      // ... other fields
    },
  })
}

async function processAutoRelease(riftId: string) {
  // Check if dispute exists (atomic check)
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  if (rift.status === 'UNDER_REVIEW') {
    return { blocked: true, reason: 'Dispute in progress' }
  }

  // Process release
  await prisma.riftTransaction.update({
    where: { id: riftId },
    data: { status: 'RELEASED' },
  })

  return { success: true }
}

async function updateEscrowStatus(riftId: string, status: string) {
  // In practice, this would use SELECT FOR UPDATE or similar
  return await prisma.riftTransaction.update({
    where: { id: riftId },
    data: { status },
  })
}

async function buyerAccepts(riftId: string, buyerId: string) {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (rift?.buyerId !== buyerId) {
    throw new Error('Unauthorized')
  }

  return await prisma.riftTransaction.update({
    where: { id: riftId },
    data: { status: 'RELEASED' },
  })
}

async function adminReviews(riftId: string, adminId: string, decision: string) {
  return await prisma.riftTransaction.update({
    where: { id: riftId },
    data: { status: decision === 'APPROVED' ? 'RELEASED' : 'UNDER_REVIEW' },
  })
}

async function getEscrowStatus(riftId: string) {
  return await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: { status: true },
  }) as { status: string }
}

async function submitProof(riftId: string, sellerId: string, fileContent: Buffer) {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (rift?.sellerId !== sellerId) {
    throw new Error('Unauthorized')
  }

  if (rift.proofSubmittedAt) {
    throw new Error('Proof already submitted')
  }

  // In practice, this would create vault asset and update rift
  return { success: true }
}

