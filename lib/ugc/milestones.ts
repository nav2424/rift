/**
 * UGC milestone engine: fund, submit delivery, request revision, approve, release.
 */

import { prisma } from '@/lib/prisma'
import { creditSellerOnRelease } from '@/lib/wallet'
import { logDealTimelineEvent } from '@/lib/ugc/timeline'
import { recordLedgerTransaction } from '@/lib/ugc/ledger'
import { checkUGCDisputeFreeze } from '@/lib/ugc/dispute-freeze'
import { MilestoneStatus } from '@prisma/client'
import { calculateSellerFee, calculateSellerNet } from '@/lib/fees'

/** Ensure deal is funded (escrow) and no dispute freezes this milestone. */
async function ensureCanProceedMilestone(milestoneId: string): Promise<{
  milestone: { id: string; riftId: string; status: MilestoneStatus; amount: number; currency: string; sellerId: string }
  rift: { id: string; sellerId: string; fundedAt: Date | null; status: string }
}> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { RiftTransaction: true },
  })
  if (!milestone) throw new Error('Milestone not found')
  const rift = milestone.RiftTransaction
  if (!rift) throw new Error('Deal not found')
  return {
    milestone: {
      id: milestone.id,
      riftId: milestone.riftId,
      status: milestone.status,
      amount: milestone.amount,
      currency: milestone.currency,
      sellerId: rift.sellerId,
    },
    rift: {
      id: rift.id,
      sellerId: rift.sellerId,
      fundedAt: rift.fundedAt,
      status: rift.status,
    },
  }
}

/** Mark milestone as funded. Call when deal payment is received (or when releasing previous unlocks next). No ledger txn here; ESCROW_FUND is recorded once when deal is funded. */
export async function fundMilestone(milestoneId: string): Promise<void> {
  const { milestone, rift } = await ensureCanProceedMilestone(milestoneId)
  if (milestone.status !== MilestoneStatus.PENDING_FUNDING) {
    throw new Error(`Milestone is not pending funding (current: ${milestone.status})`)
  }
  if (!rift.fundedAt) throw new Error('Deal is not funded; brand must fund the deal first')

  const now = new Date()
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: MilestoneStatus.FUNDED, fundedAt: now, updatedAt: now },
  })
  await logDealTimelineEvent(milestone.riftId, 'MILESTONE_FUNDED', null, { milestoneId })
}

/** Fund all milestones for a deal (when deal is fully funded upfront). */
export async function fundAllMilestonesForDeal(riftId: string): Promise<void> {
  const milestones = await prisma.milestone.findMany({
    where: { riftId, status: MilestoneStatus.PENDING_FUNDING },
    orderBy: { index: 'asc' },
  })
  for (const m of milestones) {
    await fundMilestone(m.id)
  }
}

/** Submit delivery for a milestone (creator): upload files + optional note. */
export async function submitDelivery(
  milestoneId: string,
  submittedById: string,
  options: { fileIds: string[]; note?: string }
): Promise<{ deliveryId: string }> {
  const { milestone, rift } = await ensureCanProceedMilestone(milestoneId)
  if (milestone.status !== MilestoneStatus.FUNDED && milestone.status !== MilestoneStatus.IN_REVISION) {
    throw new Error(`Cannot submit delivery: milestone status is ${milestone.status}`)
  }
  if (rift.sellerId !== submittedById) throw new Error('Only creator can submit delivery')

  const freeze = await checkUGCDisputeFreeze(milestone.riftId, milestoneId)
  if (freeze.frozen) throw new Error(freeze.reason)

  if (options.fileIds.length === 0) throw new Error('At least one file is required for delivery')

  const now = new Date()
  const delivery = await prisma.milestoneDelivery.create({
    data: {
      id: crypto.randomUUID(),
      milestoneId,
      submittedById,
      note: options.note ?? undefined,
    },
  })

  // Link vault assets to this milestone if fileIds are vault_assets ids
  await prisma.vault_assets.updateMany({
    where: { id: { in: options.fileIds }, riftId: milestone.riftId },
    data: { milestoneId },
  })

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      status: MilestoneStatus.DELIVERED,
      deliveredAt: now,
      updatedAt: now,
    },
  })

  await logDealTimelineEvent(milestone.riftId, 'DELIVERY_SUBMITTED', submittedById, {
    milestoneId,
    fileIds: options.fileIds,
    deliveryId: delivery.id,
  })

  return { deliveryId: delivery.id }
}

/** Brand requests revision; cancels auto-approve and sets milestone to IN_REVISION. */
export async function requestRevision(milestoneId: string, requestedById: string, note: string): Promise<void> {
  const { milestone, rift } = await ensureCanProceedMilestone(milestoneId)
  const riftWithBuyer = await prisma.riftTransaction.findUnique({
    where: { id: milestone.riftId },
    select: { buyerId: true },
  })
  if (!riftWithBuyer || riftWithBuyer.buyerId !== requestedById) throw new Error('Only brand can request revision')

  if (milestone.status !== MilestoneStatus.DELIVERED && milestone.status !== MilestoneStatus.IN_REVISION) {
    throw new Error(`Cannot request revision: milestone status is ${milestone.status}`)
  }
  if (milestone.revisionCount >= milestone.maxRevisions) {
    throw new Error('Revision limit reached for this milestone')
  }

  const revisionNumber = milestone.revisionCount + 1
  const now = new Date()

  await prisma.milestoneRevision.create({
    data: {
      id: crypto.randomUUID(),
      milestoneId,
      requestedById,
      revisionNumber,
      note: note || undefined,
    },
  })

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      status: MilestoneStatus.IN_REVISION,
      revisionCount: revisionNumber,
      updatedAt: now,
    },
  })

  await logDealTimelineEvent(milestone.riftId, 'REVISION_REQUESTED', requestedById, {
    milestoneId,
    revisionNumber,
    note: note?.slice(0, 200),
  })
}

/** Brand approves milestone; triggers release. */
export async function approveMilestone(milestoneId: string, approvedById: string): Promise<void> {
  const { milestone, rift } = await ensureCanProceedMilestone(milestoneId)
  const riftWithBuyer = await prisma.riftTransaction.findUnique({
    where: { id: milestone.riftId },
    select: { buyerId: true },
  })
  if (!riftWithBuyer || riftWithBuyer.buyerId !== approvedById) throw new Error('Only brand can approve')

  if (milestone.status !== MilestoneStatus.DELIVERED && milestone.status !== MilestoneStatus.IN_REVISION) {
    throw new Error(`Cannot approve: milestone status is ${milestone.status}`)
  }

  const freeze = await checkUGCDisputeFreeze(milestone.riftId, milestoneId)
  if (freeze.frozen) throw new Error(freeze.reason)

  const deliveryCount = await prisma.milestoneDelivery.count({ where: { milestoneId } })
  if (deliveryCount === 0) throw new Error('No delivery to approve')

  const now = new Date()
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: MilestoneStatus.APPROVED, approvedAt: now, updatedAt: now },
  })

  await logDealTimelineEvent(milestone.riftId, 'MILESTONE_APPROVED', approvedById, {
    milestoneId,
    approvedAt: now.toISOString(),
  })

  await releaseFundsOnApproval(milestoneId)
}

/** Auto-approve: system marks milestone approved after acceptance window. */
export async function autoApproveMilestone(milestoneId: string): Promise<void> {
  const { milestone } = await ensureCanProceedMilestone(milestoneId)
  const freeze = await checkUGCDisputeFreeze(milestone.riftId, milestoneId)
  if (freeze.frozen) return

  const deliveryCount = await prisma.milestoneDelivery.count({ where: { milestoneId } })
  if (deliveryCount === 0) return

  const now = new Date()
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: MilestoneStatus.APPROVED, autoApprovedAt: now, approvedAt: now, updatedAt: now },
  })

  await logDealTimelineEvent(milestone.riftId, 'MILESTONE_AUTO_APPROVED', null, {
    milestoneId,
    autoApprovedAt: now.toISOString(),
  })

  await releaseFundsOnApproval(milestoneId)
}

/** Release funds to creator and mark milestone RELEASED; create ledger txn and wallet credit. */
export async function releaseFundsOnApproval(milestoneId: string): Promise<void> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { RiftTransaction: { include: { seller: { select: { stripeConnectAccountId: true } } } } },
  })
  if (!milestone) throw new Error('Milestone not found')
  if (milestone.status !== MilestoneStatus.APPROVED) {
    throw new Error(`Milestone must be APPROVED to release (current: ${milestone.status})`)
  }

  const rift = milestone.RiftTransaction
  const sellerFee = calculateSellerFee(milestone.amount)
  const sellerNet = calculateSellerNet(milestone.amount)

  const now = new Date()
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: MilestoneStatus.RELEASED, updatedAt: now },
  })

  await recordLedgerTransaction(milestone.riftId, 'RELEASE_TO_CREATOR', milestone.amount, milestone.currency, {
    milestoneId,
    metadata: { sellerFee, sellerNet },
  })

  await creditSellerOnRelease(
    rift.id,
    rift.sellerId,
    sellerNet,
    rift.currency,
    { riftNumber: rift.riftNumber, itemTitle: rift.itemTitle, milestoneIndex: milestone.index }
  )

  await logDealTimelineEvent(milestone.riftId, 'MILESTONE_RELEASED', null, {
    milestoneId,
    amount: milestone.amount,
    sellerNet,
  })
}
