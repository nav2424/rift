/**
 * UGC dispute freeze: freeze auto-approvals and releases when dispute is open on a milestone.
 */

import { prisma } from '@/lib/prisma'

export interface UGCDisputeFreezeCheck {
  frozen: boolean
  reason?: string
  disputeId?: string
}

/** Check if a milestone (or deal) is frozen due to an open UGC dispute. */
export async function checkUGCDisputeFreeze(
  riftId: string,
  milestoneId?: string
): Promise<UGCDisputeFreezeCheck> {
  const where: { escrowId: string; status: any; milestoneId?: string } = {
    escrowId: riftId,
    status: { in: ['OPEN', 'NEGOTIATION', 'ADMIN_REVIEW'] },
  }
  if (milestoneId) where.milestoneId = milestoneId

  const openDisputes = await prisma.dispute.findMany({
    where,
    select: { id: true, milestoneId: true },
  })

  if (openDisputes.length > 0) {
    return {
      frozen: true,
      reason: `Active dispute(s) - auto-approval and releases are frozen until resolved`,
      disputeId: openDisputes[0].id,
    }
  }
  return { frozen: false }
}
