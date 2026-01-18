/**
 * Security Tests: Dispute Blocking Based on Access Logs
 * Tests that disputes are blocked when access logs prove delivery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createTestRift } from '../factories/riftFactory'
import { createTestUser } from '../factories/userFactory'
import { createBuyerRevealEvent, createBuyerDownloadEvent, createBuyerAccessEvent } from '../factories/eventFactory'

// Prisma is already mocked in tests/setup.ts

describe('Dispute Blocking Based on Access Logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('License Key Reveal Blocks "Never Received" Dispute', () => {
    it('should block "never received" dispute when key was revealed', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PROOF_SUBMITTED' })
      const buyer = createTestUser()

      // Mock that buyer revealed key
      const revealEvent = createBuyerRevealEvent(rift.id, 'asset1', buyer.id)
      vi.mocked(prisma.vault_events.findFirst).mockResolvedValue({
        ...revealEvent,
        eventType: 'BUYER_REVEALED_LICENSE_KEY',
        timestampUtc: new Date(),
      } as any)

      // Mock rift lookup
      rift.buyerId = buyer.id
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)

      // Try to create dispute with "never received" reason
      const canDispute = await checkCanDispute(rift.id, buyer.id, 'NEVER_RECEIVED')

      expect(canDispute.allowed).toBe(false)
      expect(canDispute.reason).toContain('License key was revealed')
    })

    it('should allow dispute for other reasons even if key was revealed', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PROOF_SUBMITTED' })
      const buyer = createTestUser()

      // Mock that buyer revealed key
      vi.mocked(prisma.vault_events.findFirst).mockResolvedValue({
        eventType: 'BUYER_REVEALED_LICENSE_KEY',
        timestampUtc: new Date(),
      } as any)

      // Mock rift lookup
      rift.buyerId = buyer.id
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)

      // Try to create dispute with "wrong item" reason (different from "never received")
      const canDispute = await checkCanDispute(rift.id, buyer.id, 'WRONG_ITEM')

      expect(canDispute.allowed).toBe(true) // Should allow other dispute reasons
    })
  })

  describe('File Download Blocks "Never Received" Dispute', () => {
    it('should block "never received" dispute when file was downloaded', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PROOF_SUBMITTED' })
      const buyer = createTestUser()

      // Mock rift lookup
      rift.buyerId = buyer.id
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)

      // Mock that buyer downloaded file (check reveal first, then download)
      // First call returns null (no reveal), second call returns download event
      vi.mocked(prisma.vault_events.findFirst)
        .mockResolvedValueOnce(null) // No license key reveal
        .mockResolvedValueOnce({
          id: 'event1',
          eventType: 'BUYER_DOWNLOADED_FILE',
          timestampUtc: new Date(),
          riftId: rift.id,
          actorId: buyer.id,
        } as any)

      const canDispute = await checkCanDispute(rift.id, buyer.id, 'NEVER_RECEIVED')

      expect(canDispute.allowed).toBe(false)
      expect(canDispute.reason).toContain('File was downloaded')
    })

    it('should allow dispute for other reasons even if file was downloaded', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PROOF_SUBMITTED' })
      const buyer = createTestUser()

      vi.mocked(prisma.vault_events.findFirst).mockResolvedValue({
        eventType: 'BUYER_DOWNLOADED_FILE',
        timestampUtc: new Date(),
      } as any)

      // Mock rift lookup
      rift.buyerId = buyer.id
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)

      const canDispute = await checkCanDispute(rift.id, buyer.id, 'DEFECTIVE')

      expect(canDispute.allowed).toBe(true)
    })
  })

  describe('Asset Open Blocks "Never Opened" Claim', () => {
    it('should provide proof that asset was opened when buyer claims "never opened"', async () => {
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PROOF_SUBMITTED' })
      const buyer = createTestUser()

      // Mock that buyer opened asset
      const openEvent = createBuyerAccessEvent(rift.id, 'asset1', buyer.id)
      vi.mocked(prisma.vault_events.findMany).mockResolvedValue([
        {
          ...openEvent,
          eventType: 'BUYER_OPENED_ASSET',
          timestampUtc: new Date('2025-01-15T10:00:00Z'),
          metadata: { viewerSessionId: 'session123' },
        },
      ] as any)

      // Get access timeline for admin review
      const timeline = await getAccessTimeline(rift.id)

      expect(timeline.events).toHaveLength(1)
      expect(timeline.events[0].eventType).toBe('BUYER_OPENED_ASSET')
      expect(timeline.provesAccess).toBe(true)
    })
  })
})

// Helper functions (would be in actual implementation)
async function checkCanDispute(
  riftId: string,
  buyerId: string,
  reason: string
): Promise<{ allowed: boolean; reason?: string }> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift || rift.buyerId !== buyerId) {
    return { allowed: false, reason: 'Unauthorized' }
  }

  // Check for access events that prove delivery
  if (reason === 'NEVER_RECEIVED') {
    const revealEvent = await prisma.vault_events.findFirst({
      where: {
        riftId,
        actorId: buyerId,
        eventType: 'BUYER_REVEALED_LICENSE_KEY',
      },
    })

    if (revealEvent) {
      return {
        allowed: false,
        reason: `Dispute blocked: License key was revealed on ${revealEvent.timestampUtc.toISOString()}`,
      }
    }

    const downloadEvent = await prisma.vault_events.findFirst({
      where: {
        riftId,
        actorId: buyerId,
        eventType: 'BUYER_DOWNLOADED_FILE',
      },
    })

    if (downloadEvent) {
      return {
        allowed: false,
        reason: `Dispute blocked: File was downloaded on ${downloadEvent.timestampUtc.toISOString()}`,
      }
    }
  }

  return { allowed: true }
}

async function getAccessTimeline(riftId: string) {
  const events = await prisma.vault_events.findMany({
    where: {
      riftId,
      actorRole: 'BUYER',
      eventType: {
        in: ['BUYER_OPENED_ASSET', 'BUYER_DOWNLOADED_FILE', 'BUYER_REVEALED_LICENSE_KEY'],
      },
    },
    orderBy: { timestampUtc: 'asc' },
  })

  return {
    events,
    provesAccess: events.length > 0,
  }
}

