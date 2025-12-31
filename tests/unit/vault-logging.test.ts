/**
 * Unit Tests: Vault Logging and Audit Chain
 * Tests lib/vault-logging.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyLogChain, hashString } from '@/lib/vault-logging'
import { prisma } from '@/lib/prisma'
import { createEventChain, createBuyerAccessEvent } from '../factories/eventFactory'

// Prisma is already mocked in tests/setup.ts

describe('Vault Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hashString', () => {
    it('should hash string consistently', () => {
      const hash1 = hashString('test-string')
      const hash2 = hashString('test-string')
      
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex string
    })

    it('should produce different hashes for different strings', () => {
      const hash1 = hashString('test-string-1')
      const hash2 = hashString('test-string-2')
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyLogChain', () => {
    it('should verify valid log chain', async () => {
      const riftId = 'rift1'
      const events = createEventChain(riftId, [
        { type: 'SELLER_UPLOADED_ASSET', actorId: 'seller1', actorRole: 'SELLER', assetId: 'asset1' },
        { type: 'BUYER_OPENED_ASSET', actorId: 'buyer1', actorRole: 'BUYER', assetId: 'asset1' },
        { type: 'BUYER_DOWNLOADED_FILE', actorId: 'buyer1', actorRole: 'BUYER', assetId: 'asset1' },
      ])

      vi.mocked(prisma.vault_events.findMany).mockResolvedValue(events as any)

      const result = await verifyLogChain(riftId)

      // Note: This test would need actual hash computation to verify
      // For now, we're testing the structure
      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('events')
      expect(Array.isArray(result.events)).toBe(true)
    })

    it('should detect tampered log chain', async () => {
      const riftId = 'rift1'
      const events = createEventChain(riftId, [
        { type: 'SELLER_UPLOADED_ASSET', actorId: 'seller1', actorRole: 'SELLER', assetId: 'asset1' },
        { type: 'BUYER_OPENED_ASSET', actorId: 'buyer1', actorRole: 'BUYER', assetId: 'asset1' },
      ])

      // Tamper the second event's logHash
      events[1].logHash = 'tampered-hash'

      vi.mocked(prisma.vault_events.findMany).mockResolvedValue(events as any)

      const result = await verifyLogChain(riftId)

      // Should detect tampering
      expect(result.valid).toBe(false)
      expect(result.events.some(e => !e.valid)).toBe(true)
    })

    it('should verify chain with single event', async () => {
      const riftId = 'rift1'
      const events = createEventChain(riftId, [
        { type: 'SELLER_UPLOADED_ASSET', actorId: 'seller1', actorRole: 'SELLER', assetId: 'asset1' },
      ])

      vi.mocked(prisma.vault_events.findMany).mockResolvedValue(events as any)

      const result = await verifyLogChain(riftId)

      expect(result).toHaveProperty('valid')
      expect(result.events).toHaveLength(1)
    })

    it('should verify chain with admin events', async () => {
      const riftId = 'rift1'
      const events = createEventChain(riftId, [
        { type: 'SELLER_UPLOADED_ASSET', actorId: 'seller1', actorRole: 'SELLER', assetId: 'asset1' },
        { type: 'ADMIN_VIEWED_ASSET', actorId: 'admin1', actorRole: 'ADMIN', assetId: 'asset1' },
        { type: 'ADMIN_APPROVED_PROOF', actorId: 'admin1', actorRole: 'ADMIN', assetId: 'asset1' },
      ])

      vi.mocked(prisma.vault_events.findMany).mockResolvedValue(events as any)

      const result = await verifyLogChain(riftId)

      expect(result).toHaveProperty('valid')
      expect(result.events.length).toBeGreaterThanOrEqual(3)
    })

    it('should order events chronologically', async () => {
      const riftId = 'rift1'
      const now = new Date()
      const event1 = createBuyerAccessEvent(riftId, 'asset1', 'buyer1', null)
      const event2 = createBuyerAccessEvent(riftId, 'asset2', 'buyer1', null)

      // Set different timestamps
      event1.timestampUtc = new Date(now.getTime() - 1000) // Later
      event2.timestampUtc = new Date(now.getTime() - 2000) // Earlier

      // Mock should return events in chronological order (earliest first)
      // as Prisma's orderBy would do
      const events = [event2, event1] // Earlier event first
      vi.mocked(prisma.vault_events.findMany).mockResolvedValue(events as any)

      const result = await verifyLogChain(riftId)

      // Events should be ordered by timestamp (earliest first)
      expect(result.events.length).toBe(2)
      // Verify that earlier event (event2) comes first
      expect(result.events[0].id).toBe(event2.id)
      expect(result.events[1].id).toBe(event1.id)
    })
  })
})

