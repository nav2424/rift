/**
 * Unit Tests: Duplicate Proof Detection
 * Tests lib/duplicate-proof-detection.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkDuplicateProofs, flagSellerForDuplicateProofs } from '@/lib/duplicate-proof-detection'
import { prisma } from '@/lib/prisma'

// Prisma is already mocked in tests/setup.ts, but we can override here if needed

describe('Duplicate Proof Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkDuplicateProofs', () => {
    it('should return LOW risk when no duplicates found', async () => {
      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue([])

      const result = await checkDuplicateProofs(
        ['hash123', 'hash456'],
        'rift1',
        'seller1'
      )

      expect(result.isDuplicate).toBe(false)
      expect(result.riskLevel).toBe('LOW')
      expect(result.duplicateRiftIds).toHaveLength(0)
    })

    it('should return LOW risk when no asset hashes provided', async () => {
      const result = await checkDuplicateProofs(
        [],
        'rift1',
        'seller1'
      )

      expect(result.isDuplicate).toBe(false)
      expect(result.riskLevel).toBe('LOW')
    })

    it('should detect CRITICAL risk when different seller uses same proof', async () => {
      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue([
        {
          id: 'asset1',
          sha256: 'hash123',
          riftId: 'rift2', // Also include riftId for grouping
        },
      ] as any)
      
      // Mock the riftTransaction.findMany call that happens after finding duplicate assets
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([
        {
          id: 'rift2',
          itemTitle: 'Other Item',
          status: 'RELEASED',
          buyerId: 'buyer2',
          sellerId: 'seller2', // Different seller
          createdAt: new Date(),
        },
      ] as any)

      const result = await checkDuplicateProofs(
        ['hash123'],
        'rift1',
        'seller1'
      )

      expect(result.isDuplicate).toBe(true)
      expect(result.riskLevel).toBe('CRITICAL')
      expect(result.duplicateRiftIds).toContain('rift2')
      expect(result.recommendations.some(r => r.includes('REQUIRES IMMEDIATE MANUAL REVIEW'))).toBe(true)
    })

    it('should detect HIGH risk when same seller reuses proof (no completed rifts)', async () => {
      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue([
        {
          id: 'asset1',
          sha256: 'hash123',
          riftId: 'rift2',
        },
      ] as any)
      
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([
        {
          id: 'rift2',
          itemTitle: 'Other Item',
          status: 'PAID', // Not completed
          buyerId: 'buyer2',
          sellerId: 'seller1', // Same seller
          createdAt: new Date(),
        },
      ] as any)

      const result = await checkDuplicateProofs(
        ['hash123'],
        'rift1',
        'seller1'
      )

      expect(result.isDuplicate).toBe(true)
      expect(result.riskLevel).toBe('HIGH')
      expect(result.recommendations.some(r => r.includes('reused proof'))).toBe(true)
    })

    it('should detect CRITICAL risk when same seller reuses proof from completed rift', async () => {
      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue([
        {
          id: 'asset1',
          sha256: 'hash123',
          riftId: 'rift2',
        },
      ] as any)
      
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([
        {
          id: 'rift2',
          itemTitle: 'Other Item',
          status: 'RELEASED', // Completed
          buyerId: 'buyer2',
          sellerId: 'seller1', // Same seller
          createdAt: new Date(),
        },
      ] as any)

      const result = await checkDuplicateProofs(
        ['hash123'],
        'rift1',
        'seller1'
      )

      expect(result.isDuplicate).toBe(true)
      expect(result.riskLevel).toBe('CRITICAL')
    })

    it('should detect CRITICAL risk when proof reused across 5+ rifts', async () => {
      const duplicateAssets = Array(6).fill(null).map((_, i) => ({
        id: `asset${i}`,
        sha256: 'hash123',
        riftId: `rift${i + 2}`, // Include riftId
      }))
      
      const rifts = Array(6).fill(null).map((_, i) => ({
        id: `rift${i + 2}`,
        itemTitle: `Item ${i}`,
        status: 'PAID',
        buyerId: `buyer${i}`,
        sellerId: 'seller1',
        createdAt: new Date(),
      }))

      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue(duplicateAssets as any)
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue(rifts as any)

      const result = await checkDuplicateProofs(
        ['hash123'],
        'rift1',
        'seller1'
      )

      expect(result.isDuplicate).toBe(true)
      expect(result.riskLevel).toBe('CRITICAL')
      expect(result.recommendations.some(r => r.includes('extreme fraud risk'))).toBe(true)
    })

    it('should identify all duplicate hashes', async () => {
      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue([
        {
          id: 'asset1',
          sha256: 'hash123',
          riftId: 'rift2',
        },
        {
          id: 'asset2',
          sha256: 'hash456',
          riftId: 'rift3',
        },
      ] as any)
      
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([
        {
          id: 'rift2',
          itemTitle: 'Item 2',
          status: 'PAID',
          buyerId: 'buyer2',
          sellerId: 'seller2',
          createdAt: new Date(),
        },
        {
          id: 'rift3',
          itemTitle: 'Item 3',
          status: 'PAID',
          buyerId: 'buyer3',
          sellerId: 'seller3',
          createdAt: new Date(),
        },
      ] as any)

      const result = await checkDuplicateProofs(
        ['hash123', 'hash456'],
        'rift1',
        'seller1'
      )

      expect(result.isDuplicate).toBe(true)
      expect(result.duplicateAssetHashes).toContain('hash123')
      expect(result.duplicateAssetHashes).toContain('hash456')
      expect(result.duplicateRiftIds).toContain('rift2')
      expect(result.duplicateRiftIds).toContain('rift3')
    })
  })

  describe('flagSellerForDuplicateProofs', () => {
    it('should not flag seller with no duplicates', async () => {
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([])

      const result = await flagSellerForDuplicateProofs('seller1')

      expect(result.shouldFlag).toBe(false)
      expect(result.duplicateCount).toBe(0)
    })

    it('should not flag seller with <3 duplicate uses', async () => {
      const riftIds = ['rift1', 'rift2']
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue(
        riftIds.map(id => ({ id }))
      )

      // Mock assets with 2 duplicate uses (same hash in 2 rifts)
      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue([
        { sha256: 'hash123', riftId: 'rift1' },
        { sha256: 'hash123', riftId: 'rift2' }, // Duplicate
      ])

      const result = await flagSellerForDuplicateProofs('seller1')

      expect(result.shouldFlag).toBe(false)
      expect(result.duplicateCount).toBe(1) // 1 extra use
    })

    it('should flag seller with 3+ duplicate uses', async () => {
      const riftIds = ['rift1', 'rift2', 'rift3', 'rift4']
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue(
        riftIds.map(id => ({ id }))
      )

      // Mock assets with 3+ duplicate uses
      vi.mocked(prisma.vault_assets.findMany).mockResolvedValue([
        { sha256: 'hash123', riftId: 'rift1' },
        { sha256: 'hash123', riftId: 'rift2' }, // Duplicate
        { sha256: 'hash123', riftId: 'rift3' }, // Duplicate
        { sha256: 'hash123', riftId: 'rift4' }, // Duplicate
      ])

      const result = await flagSellerForDuplicateProofs('seller1')

      expect(result.shouldFlag).toBe(true)
      expect(result.duplicateCount).toBeGreaterThanOrEqual(3)
      expect(result.recentRiftIds.length).toBeGreaterThan(0)
    })

    it('should only check rifts from last 30 days', async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      await flagSellerForDuplicateProofs('seller1')

      expect(prisma.riftTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      )
    })
  })
})

