import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processAutoReleases } from '@/lib/auto-release'
import { prisma } from '@/lib/prisma'
import { releaseMilestone } from '@/lib/milestone-release'
import { transitionRiftState } from '@/lib/rift-state'

vi.mock('@/lib/milestone-release', () => ({
  releaseMilestone: vi.fn(),
}))

vi.mock('@/lib/rift-state', () => ({
  transitionRiftState: vi.fn(),
}))

describe('processAutoReleases (milestone)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auto-releases the next milestone instead of full release', async () => {
    const rift = {
      id: 'rift-1',
      itemType: 'SERVICES',
      allowsPartialRelease: true,
      milestones: [{ title: 'M1', amount: 100, dueDate: '2026-01-10', reviewWindowDays: 3 }],
      autoReleaseAt: new Date('2026-01-05T00:00:00Z'),
      status: 'PROOF_SUBMITTED',
      sellerId: 'seller-1',
      buyerId: 'buyer-1',
      currency: 'USD',
      itemTitle: 'UGC Batch',
      subtotal: 100,
      Dispute: [],
      Proof: [{ status: 'VALID' }],
      MilestoneRelease: [],
    }

    vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([rift as any])

    await processAutoReleases()

    expect(releaseMilestone).toHaveBeenCalled()
    expect(transitionRiftState).not.toHaveBeenCalled()
  })
})
