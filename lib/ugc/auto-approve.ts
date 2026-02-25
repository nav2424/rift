/**
 * UGC auto-approve job: find milestones DELIVERED past acceptance window, no dispute, then auto-approve.
 * Safeguards: (a) milestone was delivered (files present), (b) no active dispute, (c) brand has not requested revision in window.
 */

import { prisma } from '@/lib/prisma'
import { checkUGCDisputeFreeze } from '@/lib/ugc/dispute-freeze'
import { autoApproveMilestone } from '@/lib/ugc/milestones'

export async function autoApproveMilestonesJob(): Promise<{ processed: number; approved: string[]; skipped: string[] }> {
  const now = new Date()
  const approved: string[] = []
  const skipped: string[] = []

  const milestones = await prisma.milestone.findMany({
    where: {
      status: 'DELIVERED',
      autoApprove: true,
      deliveredAt: { not: null },
    },
    include: {
      MilestoneDelivery: { take: 1 },
      RiftTransaction: { select: { id: true } },
    },
  })

  for (const m of milestones) {
    if (!m.deliveredAt) continue
    const windowEnd = new Date(m.deliveredAt.getTime() + m.acceptanceWindowDays * 24 * 60 * 60 * 1000)
    if (now < windowEnd) continue

    const freeze = await checkUGCDisputeFreeze(m.riftId, m.id)
    if (freeze.frozen) {
      skipped.push(m.id)
      continue
    }

    const hasDelivery = m.MilestoneDelivery.length > 0
    if (!hasDelivery) {
      skipped.push(m.id)
      continue
    }

    const latestRevision = await prisma.milestoneRevision.findFirst({
      where: { milestoneId: m.id },
      orderBy: { createdAt: 'desc' },
    })
    if (latestRevision && latestRevision.createdAt >= m.deliveredAt) {
      skipped.push(m.id)
      continue
    }

    try {
      await autoApproveMilestone(m.id)
      approved.push(m.id)
    } catch {
      skipped.push(m.id)
    }
  }

  return { processed: milestones.length, approved, skipped }
}
