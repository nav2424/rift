/**
 * UGC dispute flow: open dispute (reason code + description), admin resolve with outcome.
 */

import { prisma } from '@/lib/prisma'
import { logDealTimelineEvent } from '@/lib/ugc/timeline'
import { recordLedgerTransaction } from '@/lib/ugc/ledger'
import { creditSellerOnRelease } from '@/lib/wallet'
import type { UGCDisputeReasonCode, DisputeOutcome } from '@prisma/client'

export const UGC_DISPUTE_REASON_CODES: UGCDisputeReasonCode[] = [
  'DELIVERABLE_NOT_RECEIVED',
  'DELIVERABLE_NOT_AS_SPECIFIED',
  'LATE_DELIVERY',
  'SCOPE_CHANGE_REQUESTED',
  'IP_RIGHTS_CONFLICT',
  'PAYMENT_ISSUE',
  'OTHER',
]

export interface OpenDisputeInput {
  riftId: string
  milestoneId: string
  openedById: string
  reasonCode: UGCDisputeReasonCode
  description: string
}

/** Open dispute on a milestone; freezes auto-approval and releases. */
export async function openDispute(input: OpenDisputeInput): Promise<{ disputeId: string }> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: input.milestoneId },
    include: { RiftTransaction: true },
  })
  if (!milestone || milestone.riftId !== input.riftId) throw new Error('Milestone not found')
  const rift = milestone.RiftTransaction
  if (rift.buyerId !== input.openedById && rift.sellerId !== input.openedById) {
    throw new Error('Only brand or creator can open a dispute on this deal')
  }

  const existing = await prisma.dispute.findFirst({
    where: {
      escrowId: input.riftId,
      milestoneId: input.milestoneId,
      status: { in: ['OPEN', 'NEGOTIATION', 'ADMIN_REVIEW'] },
    },
  })
  if (existing) throw new Error('An open dispute already exists for this milestone')

  const now = new Date()
  const dispute = await prisma.dispute.create({
    data: {
      id: crypto.randomUUID(),
      escrowId: input.riftId,
      milestoneId: input.milestoneId,
      raisedById: input.openedById,
      reason: input.description.slice(0, 500),
      description: input.description,
      reasonCode: input.reasonCode,
      type: 'OTHER',
      status: 'OPEN',
      updatedAt: now,
    },
  })

  await prisma.milestone.update({
    where: { id: input.milestoneId },
    data: { status: 'DISPUTED', updatedAt: now },
  })

  await prisma.riftTransaction.update({
    where: { id: input.riftId },
    data: { status: 'DISPUTED', updatedAt: now },
  })

  await logDealTimelineEvent(input.riftId, 'DISPUTE_OPENED', input.openedById, {
    disputeId: dispute.id,
    milestoneId: input.milestoneId,
    reasonCode: input.reasonCode,
  })

  return { disputeId: dispute.id }
}

export interface AdminResolveDisputeInput {
  disputeId: string
  adminUserId: string
  outcome: DisputeOutcome
  decisionNote: string
  /** For SPLIT: [amountToCreator, amountToBrand] */
  amounts?: [number, number]
}

/** Admin resolves dispute; applies payout/refund and updates milestone. */
export async function adminResolveDispute(input: AdminResolveDisputeInput): Promise<void> {
  const dispute = await prisma.dispute.findUnique({
    where: { id: input.disputeId },
    include: {
      RiftTransaction: { include: { seller: true, buyer: true } },
      Milestone: true,
    },
  })
  if (!dispute) throw new Error('Dispute not found')
  if (dispute.status === 'RESOLVED') throw new Error('Dispute already resolved')

  const rift = dispute.RiftTransaction
  const milestone = dispute.Milestone
  const now = new Date()

  await prisma.dispute.update({
    where: { id: input.disputeId },
    data: {
      status: 'RESOLVED',
      outcome: input.outcome,
      decisionNote: input.decisionNote,
      resolvedById: input.adminUserId,
      resolvedAt: now,
      updatedAt: now,
    },
  })

  await logDealTimelineEvent(rift.id, 'DISPUTE_CLOSED', input.adminUserId, {
    disputeId: input.disputeId,
    outcome: input.outcome,
    decisionNote: input.decisionNote.slice(0, 200),
  })

  if (milestone) {
    const currency = milestone.currency ?? rift.currency

    if (input.outcome === 'RELEASE_TO_CREATOR') {
      await recordLedgerTransaction(rift.id, 'RELEASE_TO_CREATOR', milestone.amount, currency, {
        milestoneId: milestone.id,
        metadata: { disputeId: input.disputeId },
      })
      const { calculateSellerNet } = await import('@/lib/fees')
      const sellerNet = calculateSellerNet(milestone.amount)
      await creditSellerOnRelease(
        rift.id,
        rift.sellerId,
        sellerNet,
        rift.currency,
        { riftNumber: rift.riftNumber, itemTitle: rift.itemTitle, milestoneIndex: milestone.index, disputeId: input.disputeId }
      )
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { status: 'RELEASED', updatedAt: now },
      })
    } else if (input.outcome === 'REFUND_TO_BRAND') {
      await recordLedgerTransaction(rift.id, 'REFUND_TO_BRAND', milestone.amount, currency, {
        milestoneId: milestone.id,
        metadata: { disputeId: input.disputeId },
      })
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { status: 'CANCELED', updatedAt: now },
      })
    } else if (input.outcome === 'SPLIT' && input.amounts) {
      const [toCreator, toBrand] = input.amounts
      await recordLedgerTransaction(rift.id, 'SPLIT_RELEASE', toCreator, currency, {
        milestoneId: milestone.id,
        metadata: { toBrand, disputeId: input.disputeId },
      })
      if (toCreator > 0) {
        const { calculateSellerNet } = await import('@/lib/fees')
        const sellerNet = calculateSellerNet(toCreator)
        await creditSellerOnRelease(
          rift.id,
          rift.sellerId,
          sellerNet,
          rift.currency,
          { riftNumber: rift.riftNumber, itemTitle: rift.itemTitle, milestoneIndex: milestone.index, disputeId: input.disputeId }
        )
      }
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { status: 'RELEASED', updatedAt: now },
      })
    } else if (input.outcome === 'REQUIRE_REVISION') {
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: {
          status: 'IN_REVISION',
          revisionCount: { increment: 1 },
          updatedAt: now,
        },
      })
    }
  }

  // If rift had only this dispute, consider moving rift status back from DISPUTED
  const otherOpen = await prisma.dispute.count({
    where: { escrowId: rift.id, status: { in: ['OPEN', 'NEGOTIATION', 'ADMIN_REVIEW'] } },
  })
  if (otherOpen === 0) {
    await prisma.riftTransaction.update({
      where: { id: rift.id },
      data: { status: 'FUNDED', updatedAt: now },
    })
  }
}
