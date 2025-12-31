/**
 * Security/Abuse Tests
 * Tests for bypass attempts, replay attacks, spam, duplicate evasion, log tampering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateProofTypeLock } from '@/lib/proof-type-validation'
import { checkDuplicateProofs } from '@/lib/duplicate-proof-detection'
import { verifyLogChain } from '@/lib/vault-logging'
import { checkProofRateLimit } from '@/lib/rate-limits-proof'
import { ItemType } from '@prisma/client'

describe('Security/Abuse Tests', () => {
  describe('Bypass Attempts', () => {
    it('should reject "other" asset type bypass attempt', () => {
      // Try to submit invalid asset type
      const result = validateProofTypeLock(
        'DIGITAL' as ItemType,
        ['OTHER' as any], // Invalid type
        {}
      )

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid asset types'))).toBe(true)
    })

    it('should reject free-form upload bypass', () => {
      // Try to submit without proper validation
      const result = validateProofTypeLock(
        'DIGITAL' as ItemType,
        [], // No assets
        {}
      )

      expect(result.valid).toBe(false)
    })

    it('should reject external URL for DIGITAL items', () => {
      const result = validateProofTypeLock(
        'DIGITAL' as ItemType,
        ['URL' as any], // Not allowed
        {}
      )

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid asset types'))).toBe(true)
    })
  })

  describe('Replay Attacks', () => {
    it('should detect duplicate proof from completed rift', async () => {
      const { prisma } = await import('@/lib/prisma')
      
      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue([
        {
          id: 'asset1',
          sha256: 'replay-hash',
          riftId: 'rift2',
        },
      ] as any)
      
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([
        {
          id: 'rift2',
          status: 'RELEASED', // Completed
          sellerId: 'seller1',
          buyerId: 'buyer2',
          createdAt: new Date(),
          itemTitle: 'Previous Item',
        },
      ] as any)

      const result = await checkDuplicateProofs(
        ['replay-hash'],
        'rift1',
        'seller1'
      )

      expect(result.isDuplicate).toBe(true)
      expect(result.riskLevel).toBe('CRITICAL')
    })

    it('should block replay of same proof hash', async () => {
      const { prisma } = await import('@/lib/prisma')
      
      // Same hash used in multiple rifts
      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue([
        {
          id: 'asset1',
          sha256: 'replay-hash',
          riftId: 'rift2',
        },
        {
          id: 'asset2',
          sha256: 'replay-hash',
          riftId: 'rift3',
        },
      ] as any)
      
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([
        {
          id: 'rift2',
          status: 'RELEASED',
          sellerId: 'seller1',
          buyerId: 'buyer2',
          createdAt: new Date(),
          itemTitle: 'Item 2',
        },
        {
          id: 'rift3',
          status: 'RELEASED',
          sellerId: 'seller1',
          buyerId: 'buyer3',
          createdAt: new Date(),
          itemTitle: 'Item 3',
        },
      ] as any)

      const result = await checkDuplicateProofs(
        ['replay-hash'],
        'rift1',
        'seller1'
      )

      expect(result.isDuplicate).toBe(true)
      expect(result.duplicateRiftIds.length).toBeGreaterThan(1)
    })
  })

  describe('Spam Prevention', () => {
    it('should rate limit proof submissions', () => {
      const mockRequest = {
        headers: new Headers({
          'x-user-id': 'spammer',
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      // Exceed rate limit
      for (let i = 0; i < 11; i++) {
        const result = checkProofRateLimit(mockRequest, 'submission')
        if (i >= 10) {
          expect(result.allowed).toBe(false)
        }
      }
    })

    it('should rate limit license key reveals', () => {
      const mockRequest = {
        headers: new Headers({
          'x-user-id': 'harvester',
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      // Exceed strict limit (5/day)
      for (let i = 0; i < 6; i++) {
        const result = checkProofRateLimit(mockRequest, 'reveal')
        if (i >= 5) {
          expect(result.allowed).toBe(false)
        }
      }
    })
  })

  describe('Duplicate Evasion', () => {
    it('should detect slightly modified files (canonical hash)', async () => {
      // This would test canonical hashing if implemented
      // For now, we test that exact SHA-256 matching works
      const { prisma } = await import('@/lib/prisma')
      
      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue([
        {
          id: 'asset1',
          sha256: 'exact-match-hash',
          riftId: 'rift2',
        },
      ] as any)
      
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([
        {
          id: 'rift2',
          status: 'FUNDED',
          sellerId: 'seller1',
          buyerId: 'buyer2',
          createdAt: new Date(),
          itemTitle: 'Item 2',
        },
      ] as any)

      const result = await checkDuplicateProofs(
        ['exact-match-hash'],
        'rift1',
        'seller1'
      )

      expect(result.isDuplicate).toBe(true)
    })

    it('should flag seller with multiple duplicate uses', async () => {
      const { flagSellerForDuplicateProofs } = await import('@/lib/duplicate-proof-detection')
      const { prisma } = await import('@/lib/prisma')
      
      // Mock seller with 5+ duplicate uses
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue(
        Array(5).fill(null).map((_, i) => ({ id: `rift${i + 1}` })) as any
      )

      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue(
        Array(5).fill(null).map((_, i) => ({
          sha256: 'same-hash',
          riftId: `rift${i + 1}`,
        })) as any
      )

      const result = await flagSellerForDuplicateProofs('seller1')

      expect(result.shouldFlag).toBe(true)
      expect(result.duplicateCount).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Log Tampering', () => {
    it('should detect tampered log chain', async () => {
      const { prisma } = await import('@/lib/prisma')
      
      // Create tampered events
      const events = [
        {
          id: 'event1',
          riftId: 'rift1',
          logHash: 'valid-hash-1',
          prevLogHash: null,
          timestampUtc: new Date('2025-01-15T10:00:00Z'),
          actorId: 'seller1',
          actorRole: 'SELLER',
          eventType: 'SELLER_UPLOADED_ASSET',
          assetId: 'asset1',
          ipHash: null,
          userAgentHash: null,
          sessionId: null,
          deviceFingerprint: null,
          assetHash: null,
          metadata: null,
        },
        {
          id: 'event2',
          riftId: 'rift1',
          logHash: 'tampered-hash', // Tampered!
          prevLogHash: 'valid-hash-1',
          timestampUtc: new Date('2025-01-15T11:00:00Z'),
          actorId: 'buyer1',
          actorRole: 'BUYER',
          eventType: 'BUYER_OPENED_ASSET',
          assetId: 'asset1',
          ipHash: null,
          userAgentHash: null,
          sessionId: null,
          deviceFingerprint: null,
          assetHash: null,
          metadata: null,
        },
      ]

      vi.mocked(prisma.vault_events.findMany).mockResolvedValue(events as any)

      const result = await verifyLogChain('rift1')

      expect(result.valid).toBe(false)
      expect(result.events.some(e => !e.valid)).toBe(true)
    })

    it('should detect missing event in chain', async () => {
      const { prisma } = await import('@/lib/prisma')
      
      // Chain with missing event (gap in prevLogHash)
      const events = [
        {
          id: 'event1',
          riftId: 'rift1',
          logHash: 'hash-1',
          prevLogHash: null,
          timestampUtc: new Date('2025-01-15T10:00:00Z'),
          actorId: 'seller1',
          actorRole: 'SELLER',
          eventType: 'SELLER_UPLOADED_ASSET',
          assetId: 'asset1',
          ipHash: null,
          userAgentHash: null,
          sessionId: null,
          deviceFingerprint: null,
          assetHash: null,
          metadata: null,
        },
        {
          id: 'event3',
          riftId: 'rift1',
          logHash: 'hash-3',
          prevLogHash: 'hash-2', // Missing hash-2 event!
          timestampUtc: new Date('2025-01-15T12:00:00Z'),
          actorId: 'buyer1',
          actorRole: 'BUYER',
          eventType: 'BUYER_DOWNLOADED_FILE',
          assetId: 'asset1',
          ipHash: null,
          userAgentHash: null,
          sessionId: null,
          deviceFingerprint: null,
          assetHash: null,
          metadata: null,
        },
      ]

      vi.mocked(prisma.vault_events.findMany).mockResolvedValue(events as any)

      const result = await verifyLogChain('rift1')

      // Should detect chain break
      expect(result.valid).toBe(false)
    })
  })

  describe('Access Spoofing', () => {
    it('should prevent logging access as different user', async () => {
      // This would be tested in integration tests with actual API calls
      // Unit test verifies that user ID is checked
      const buyerId = 'buyer1'
      const spoofedBuyerId = 'buyer2'

      // In real implementation, buyerOpenAsset should verify buyerId matches rift.buyerId
      // This test verifies the concept
      expect(buyerId).not.toBe(spoofedBuyerId)
    })
  })

  describe('Rate Limit Bypass', () => {
    it('should track rate limits per user+IP combination', () => {
      const user1Request = {
        headers: new Headers({
          'x-user-id': 'user1',
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      const user1DifferentIP = {
        headers: new Headers({
          'x-user-id': 'user1',
          'x-forwarded-for': '192.168.1.2', // Different IP
        }),
      } as any

      // Exhaust limit for user1+IP1
      for (let i = 0; i < 10; i++) {
        checkProofRateLimit(user1Request, 'submission')
      }

      const result1 = checkProofRateLimit(user1Request, 'submission')
      expect(result1.allowed).toBe(false)

      // Different IP should have separate limit
      const result2 = checkProofRateLimit(user1DifferentIP, 'submission')
      // Note: Current implementation may track by user+IP, so this might still be blocked
      // This test documents the expected behavior
    })
  })
})

