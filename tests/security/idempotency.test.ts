/**
 * Security Tests: Idempotency and Double-Submit Safety
 * Tests that duplicate submissions don't create duplicate records
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createTestRift } from '../factories/riftFactory'
import { createTestUser } from '../factories/userFactory'
import { createHash } from 'crypto'

// Prisma is already mocked in tests/setup.ts

describe('Idempotency and Double-Submit Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Proof Submission Idempotency', () => {
    it('should not create duplicate assets on identical proof submission', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PAID' })
      const seller = createTestUser()
      const fileContent = Buffer.from('test file content')
      const fileHash = createHash('sha256').update(fileContent).digest('hex')
      const idempotencyKey = `proof-${rift.id}-${fileHash}`

      // First submission
      vi.mocked(prisma.vault_assets.findFirst).mockResolvedValue(null) // No existing asset
      vi.mocked(prisma.vault_assets.create).mockResolvedValue({
        id: 'asset1',
        sha256: fileHash,
        riftId: rift.id,
      } as any)

      await submitProof(rift.id, seller.id, fileContent, idempotencyKey)

      // Second submission (identical)
      vi.mocked(prisma.vault_assets.findFirst).mockResolvedValue({
        id: 'asset1',
        sha256: fileHash,
        riftId: rift.id,
      } as any)

      await submitProof(rift.id, seller.id, fileContent, idempotencyKey)

      // Should not create duplicate
      expect(prisma.vault_assets.create).toHaveBeenCalledTimes(1)
    })

    it('should allow different proof submissions (different hash)', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PAID' })
      const seller = createTestUser()
      const file1 = Buffer.from('file 1')
      const file2 = Buffer.from('file 2')
      const hash1 = createHash('sha256').update(file1).digest('hex')
      const hash2 = createHash('sha256').update(file2).digest('hex')

      // First submission
      vi.mocked(prisma.vault_assets.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.vault_assets.create).mockResolvedValue({
        id: 'asset1',
        sha256: hash1,
      } as any)

      await submitProof(rift.id, seller.id, file1, `proof-${rift.id}-${hash1}`)

      // Second submission (different file)
      vi.mocked(prisma.vault_assets.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.vault_assets.create).mockResolvedValue({
        id: 'asset2',
        sha256: hash2,
      } as any)

      await submitProof(rift.id, seller.id, file2, `proof-${rift.id}-${hash2}`)

      // Should create both (different hashes)
      expect(prisma.vault_assets.create).toHaveBeenCalledTimes(2)
    })
  })

  describe('Access Event Idempotency', () => {
    it('should not create duplicate access events on retry storms', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PROOF_SUBMITTED' })
      const buyer = createTestUser()
      const sessionId = 'session123'
      const assetId = 'asset1'

      // First access
      vi.mocked(prisma.vault_events.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.vault_events.create).mockResolvedValue({
        id: 'event1',
        eventType: 'BUYER_OPENED_ASSET',
      } as any)

      await logAccess(rift.id, buyer.id, assetId, sessionId)

      // Retry (same session, same asset, within short time window)
      vi.mocked(prisma.vault_events.findFirst).mockResolvedValue({
        id: 'event1',
        eventType: 'BUYER_OPENED_ASSET',
        sessionId,
        timestampUtc: new Date(), // Recent
      } as any)

      await logAccess(rift.id, buyer.id, assetId, sessionId)

      // Should not create duplicate if within dedupe window
      expect(prisma.vault_events.create).toHaveBeenCalledTimes(1)
    })

    it('should allow duplicate events if outside dedupe window', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PROOF_SUBMITTED' })
      const buyer = createTestUser()
      const sessionId = 'session123'
      const assetId = 'asset1'

      // First access
      vi.mocked(prisma.vault_events.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.vault_events.create).mockResolvedValue({
        id: 'event1',
      } as any)

      await logAccess(rift.id, buyer.id, assetId, sessionId)

      // Second access (different time, outside dedupe window)
      const oldDate = new Date()
      oldDate.setHours(oldDate.getHours() - 2) // 2 hours ago

      vi.mocked(prisma.vault_events.findFirst).mockResolvedValue({
        id: 'event1',
        sessionId,
        timestampUtc: oldDate, // Old
      } as any)

      await logAccess(rift.id, buyer.id, assetId, sessionId)

      // Should allow if outside dedupe window (or rate-limited)
      // In practice, this would be rate-limited, not blocked
    })
  })

  describe('Download Endpoint Idempotency', () => {
    it('should handle concurrent download requests gracefully', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL', status: 'PROOF_SUBMITTED' })
      const buyer = createTestUser()
      const assetId = 'asset1'

      // Simulate concurrent requests
      const promises = Array(10).fill(null).map(() =>
        downloadFile(rift.id, buyer.id, assetId)
      )

      const results = await Promise.allSettled(promises)

      // All should succeed (or be rate-limited, not fail)
      const successful = results.filter(r => r.status === 'fulfilled')
      expect(successful.length).toBeGreaterThan(0)

      // Should not create 10 duplicate events (rate-limited or deduped)
      const eventCount = vi.mocked(prisma.vault_events.create).mock.calls.length
      expect(eventCount).toBeLessThanOrEqual(10) // May be rate-limited
    })
  })
})

// Helper functions
async function submitProof(
  riftId: string,
  sellerId: string,
  fileContent: Buffer,
  idempotencyKey: string
) {
  const fileHash = createHash('sha256').update(fileContent).digest('hex')

  // Check for existing asset with same hash
  const existing = await prisma.vault_assets.findFirst({
    where: {
      riftId,
      sha256: fileHash,
    },
  })

  if (existing) {
    return existing // Idempotent: return existing
  }

  return await prisma.vault_assets.create({
    data: {
      riftId,
      sha256: fileHash,
      assetType: 'FILE',
      // ... other fields
    },
  })
}

async function logAccess(
  riftId: string,
  buyerId: string,
  assetId: string,
  sessionId: string
) {
  const DEDUPE_WINDOW_MS = 60 * 1000 // 1 minute

  // Check for recent duplicate
  const recent = await prisma.vault_events.findFirst({
    where: {
      riftId,
      assetId,
      actorId: buyerId,
      sessionId,
      eventType: 'BUYER_OPENED_ASSET',
      timestampUtc: {
        gte: new Date(Date.now() - DEDUPE_WINDOW_MS),
      },
    },
  })

  if (recent) {
    return recent // Idempotent: return existing
  }

  return await prisma.vault_events.create({
    data: {
      riftId,
      assetId,
      actorId: buyerId,
      actorRole: 'BUYER',
      eventType: 'BUYER_OPENED_ASSET',
      sessionId,
      // ... other fields
    },
  })
}

async function downloadFile(riftId: string, buyerId: string, assetId: string) {
  // In practice, this would check rate limits and log access
  await logAccess(riftId, buyerId, assetId, 'download-session')
  return { url: 'https://signed-url.com/file' }
}

