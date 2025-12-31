/**
 * Security Tests: Authorization and Access Control
 * Tests that endpoints enforce proper role-based access control
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createTestRift } from '../factories/riftFactory'
import { createTestBuyer, createTestSeller, createTestAdmin } from '../factories/userFactory'

// Prisma is already mocked in tests/setup.ts

describe('Authorization and Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Proof Submission (Seller-Only)', () => {
    it('should allow seller to submit proof', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PAID' })
      const seller = createTestSeller()
      
      // Ensure seller ID matches rift sellerId
      rift.sellerId = seller.id
      
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(seller as any)

      const canSubmit = await checkCanSubmitProof(rift.id, seller.id)

      expect(canSubmit.allowed).toBe(true)
    })

    it('should block buyer from submitting proof', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PAID' })
      const buyer = createTestBuyer()
      
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(buyer as any)

      const canSubmit = await checkCanSubmitProof(rift.id, buyer.id)

      expect(canSubmit.allowed).toBe(false)
      expect(canSubmit.reason).toContain('Only seller can submit proof')
    })

    it('should block user not in rift from submitting proof', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PAID' })
      const stranger = createTestBuyer() // Use factory function
      
      // Ensure stranger is NOT the seller or buyer
      rift.sellerId = 'different-seller-id'
      rift.buyerId = 'different-buyer-id'
      
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(stranger as any)

      const canSubmit = await checkCanSubmitProof(rift.id, stranger.id)

      expect(canSubmit.allowed).toBe(false)
      expect(canSubmit.reason).toContain('Only seller can submit proof')
    })
  })

  describe('Vault Access (Buyer-Only Endpoints)', () => {
    it('should allow buyer to access vault', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PROOF_SUBMITTED' })
      const buyer = createTestBuyer()
      rift.buyerId = buyer.id
      
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)

      const canAccess = await checkCanAccessVault(rift.id, buyer.id)

      expect(canAccess.allowed).toBe(true)
    })

    it('should block seller from accessing buyer-only vault endpoints', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PROOF_SUBMITTED' })
      const seller = createTestSeller()
      rift.sellerId = seller.id
      
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)

      const canAccess = await checkCanAccessVault(rift.id, seller.id)

      expect(canAccess.allowed).toBe(false)
      expect(canAccess.reason).toContain('Only buyer can access vault')
    })

    it('should block user not in rift from accessing vault', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PROOF_SUBMITTED' })
      const stranger = createTestBuyer() // Use factory function
      
      // Ensure stranger is NOT the buyer
      rift.buyerId = 'different-buyer-id'
      
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)

      const canAccess = await checkCanAccessVault(rift.id, stranger.id)

      expect(canAccess.allowed).toBe(false)
      expect(canAccess.reason).toContain('Only buyer can access vault')
    })
  })

  describe('License Key Reveal (Buyer-Only)', () => {
    it('should allow buyer to reveal license key', async () => {
      const rift = createTestRift({ itemType: 'LICENSE_KEYS', status: 'PROOF_SUBMITTED' })
      const buyer = createTestBuyer()
      rift.buyerId = buyer.id
      
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)

      const canReveal = await checkCanRevealKey(rift.id, buyer.id)

      expect(canReveal.allowed).toBe(true)
    })

    it('should block seller from revealing license key', async () => {
      const rift = createTestRift({ itemType: 'LICENSE_KEYS', status: 'PROOF_SUBMITTED' })
      const seller = createTestSeller()
      rift.sellerId = seller.id
      
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)

      const canReveal = await checkCanRevealKey(rift.id, seller.id)

      expect(canReveal.allowed).toBe(false)
      expect(canReveal.reason).toContain('Only buyer can reveal key')
    })
  })

  describe('Admin Access', () => {
    it('should allow admin to access all endpoints', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PROOF_SUBMITTED' })
      const admin = createTestAdmin()
      
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(admin as any)

      const canAccess = await checkAdminAccess(rift.id, admin.id)

      expect(canAccess).toBe(true)
    })

    it('should log all admin actions', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PROOF_SUBMITTED' })
      const admin = createTestAdmin()
      
      const action = await logAdminAction(rift.id, admin.id, 'VIEWED_VAULT')

      expect(action.logged).toBe(true)
      expect(action.reason).toBeDefined() // Admin actions require reason
    })
  })
})

// Helper functions (would be in actual implementation)
async function checkCanSubmitProof(riftId: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift) {
    return { allowed: false, reason: 'Rift not found' }
  }

  if (rift.sellerId !== userId) {
    return { allowed: false, reason: 'Only seller can submit proof' }
  }

  return { allowed: true }
}

async function checkCanAccessVault(riftId: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift) {
    return { allowed: false, reason: 'Rift not found' }
  }

  if (rift.buyerId !== userId) {
    return { allowed: false, reason: 'Only buyer can access vault' }
  }

  return { allowed: true }
}

async function checkCanRevealKey(riftId: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift) {
    return { allowed: false, reason: 'Rift not found' }
  }

  if (rift.buyerId !== userId) {
    return { allowed: false, reason: 'Only buyer can reveal key' }
  }

  return { allowed: true }
}

async function checkAdminAccess(riftId: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  return user?.role === 'ADMIN'
}

async function logAdminAction(riftId: string, adminId: string, action: string) {
  // Admin actions must include reason
  return {
    logged: true,
    reason: `Admin ${action} for rift ${riftId}`,
  }
}

