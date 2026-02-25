import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@prisma/client', async () => {
  const actual: any = await vi.importActual('@prisma/client')
  return {
    ...actual,
    MilestoneStatus: {
      DRAFT: 'DRAFT',
      PENDING_FUNDING: 'PENDING_FUNDING',
      FUNDED: 'FUNDED',
      IN_PROGRESS: 'IN_PROGRESS',
      DELIVERED: 'DELIVERED',
      IN_REVISION: 'IN_REVISION',
      APPROVED: 'APPROVED',
      DISPUTED: 'DISPUTED',
      RELEASED: 'RELEASED',
      CANCELED: 'CANCELED',
    },
  }
})

// Mocks
vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      milestone: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      milestoneDelivery: {
        count: vi.fn(),
        create: vi.fn(),
      },
      milestoneRevision: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      dispute: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      riftTransaction: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      vault_assets: {
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      ledgerTransaction: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      dealTimelineEvent: {
        create: vi.fn(),
      },
    },
  }
})

vi.mock('@/lib/ugc/dispute-freeze', () => ({
  checkUGCDisputeFreeze: vi.fn(async () => ({ frozen: false })),
}))

vi.mock('@/lib/ugc/ledger', () => ({
  recordLedgerTransaction: vi.fn(async () => {}),
}))

vi.mock('@/lib/wallet', () => ({
  creditSellerOnRelease: vi.fn(async () => {}),
}))

vi.mock('@/lib/ugc/timeline', () => ({
  logDealTimelineEvent: vi.fn(async () => {}),
}))

import { prisma } from '@/lib/prisma'
import { autoApproveMilestonesJob } from '@/lib/ugc/auto-approve'
import { approveMilestone } from '@/lib/ugc/milestones'
import { adminResolveDispute } from '@/lib/ugc/disputes'
import { checkUGCDisputeFreeze } from '@/lib/ugc/dispute-freeze'
import { recordLedgerTransaction } from '@/lib/ugc/ledger'
import { creditSellerOnRelease } from '@/lib/wallet'

describe('UGC workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auto-approve only after delivered + window elapsed', async () => {
    const deliveredAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    ;(prisma.milestone.findMany as any).mockResolvedValue([
      {
        id: 'm1',
        riftId: 'r1',
        status: 'DELIVERED',
        autoApprove: true,
        deliveredAt,
        acceptanceWindowDays: 3,
        MilestoneDelivery: [{ id: 'd1' }],
      },
    ])
    ;(prisma.milestoneRevision.findFirst as any).mockResolvedValue(null)
    ;(prisma.milestone.findUnique as any).mockResolvedValue({
      id: 'm1',
      riftId: 'r1',
      index: 0,
      status: 'DELIVERED',
      amount: 100,
      currency: 'CAD',
      autoApprove: true,
      acceptanceWindowDays: 3,
      RiftTransaction: { id: 'r1', sellerId: 'creator', buyerId: 'brand', fundedAt: new Date(), status: 'FUNDED' },
    })

    // delivery exists
    const { checkUGCDisputeFreeze } = await import('@/lib/ugc/dispute-freeze')
    ;(checkUGCDisputeFreeze as any).mockResolvedValue({ frozen: false })

    ;(prisma.milestoneDelivery.count as any).mockResolvedValue(1)
    ;(prisma.milestone.update as any).mockResolvedValue({})

    await autoApproveMilestonesJob()
    expect(prisma.milestone.update).toHaveBeenCalled()
  })

  it('revision request cancels auto-approve (skip if revision after deliveredAt)', async () => {
    const deliveredAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    ;(prisma.milestone.findMany as any).mockResolvedValue([
      {
        id: 'm1',
        riftId: 'r1',
        status: 'DELIVERED',
        autoApprove: true,
        deliveredAt,
        acceptanceWindowDays: 3,
        MilestoneDelivery: [{ id: 'd1' }],
      },
    ])
    ;(prisma.milestoneRevision.findFirst as any).mockResolvedValue({
      id: 'rev1',
      createdAt: new Date(deliveredAt.getTime() + 1000),
    })
    ;(prisma.milestone.findUnique as any).mockResolvedValue({
      id: 'm1',
      riftId: 'r1',
      index: 0,
      status: 'DELIVERED',
      amount: 100,
      currency: 'CAD',
      autoApprove: true,
      acceptanceWindowDays: 3,
      RiftTransaction: { id: 'r1', sellerId: 'creator', buyerId: 'brand', fundedAt: new Date(), status: 'FUNDED' },
    })

    ;(prisma.milestoneDelivery.count as any).mockResolvedValue(1)
    ;(prisma.milestone.update as any).mockResolvedValue({})

    const res = await autoApproveMilestonesJob()
    expect(res.approved).toEqual([])
    expect(prisma.milestone.update).not.toHaveBeenCalled()
  })

  it('dispute freezes release (approveMilestone throws when frozen)', async () => {
    ;(prisma.milestone.findUnique as any).mockResolvedValue({
      id: 'm1',
      riftId: 'r1',
      status: 'DELIVERED',
      amount: 100,
      currency: 'CAD',
      RiftTransaction: { id: 'r1', sellerId: 'creator', buyerId: 'brand', fundedAt: new Date(), status: 'FUNDED' },
      revisionCount: 0,
      maxRevisions: 1,
    })
    ;(prisma.riftTransaction.findUnique as any).mockResolvedValue({ buyerId: 'brand' })
    ;(prisma.milestoneDelivery.count as any).mockResolvedValue(1)
    ;(checkUGCDisputeFreeze as any).mockResolvedValue({ frozen: true, reason: 'Active dispute' })

    await expect(approveMilestone('m1', 'brand')).rejects.toThrow('Active dispute')
  })

  it('admin split resolution creates correct ledger txns', async () => {
    ;(prisma.dispute.findUnique as any).mockResolvedValue({
      id: 'd1',
      status: 'OPEN',
      escrowId: 'r1',
      RiftTransaction: { id: 'r1', sellerId: 'creator', buyerId: 'brand', currency: 'CAD', riftNumber: 123, itemTitle: 'UGC' },
      Milestone: { id: 'm1', index: 0, amount: 100, currency: 'CAD' },
    })
    ;(prisma.dispute.update as any).mockResolvedValue({})
    ;(prisma.milestone.update as any).mockResolvedValue({})
    ;(prisma.dispute.count as any).mockResolvedValue(0)
    ;(prisma.riftTransaction.update as any).mockResolvedValue({})

    await adminResolveDispute({
      disputeId: 'd1',
      adminUserId: 'admin',
      outcome: 'SPLIT',
      decisionNote: 'split',
      amounts: [30, 70],
    })

    expect(recordLedgerTransaction).toHaveBeenCalledWith(
      'r1',
      'SPLIT_RELEASE',
      30,
      'CAD',
      expect.objectContaining({ milestoneId: 'm1' })
    )
    expect(creditSellerOnRelease).toHaveBeenCalled()
  })
})

