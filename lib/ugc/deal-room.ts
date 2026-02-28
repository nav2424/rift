/**
 * UGC deal room: create deal, apply contract template, create milestones from contract.
 */

import { prisma } from '@/lib/prisma'
import { generateNextRiftNumber } from '@/lib/rift-number'
import { calculateBuyerFee, calculateSellerFee, calculateSellerNet } from '@/lib/fees'
import { logDealTimelineEvent } from '@/lib/ugc/timeline'
import {
  buildUGCContractFromTemplate,
  UGC_DEFAULT_MILESTONES,
  type UGCContractPayload,
  type UGCTemplateMilestone,
} from '@/lib/ugc/contract-template'
import { MilestoneStatus } from '@prisma/client'

export interface CreateDealRoomInput {
  brandId: string
  creatorId: string
  itemTitle: string
  itemDescription: string
  totalAmount: number
  currency?: string
  contractOverrides?: Parameters<typeof buildUGCContractFromTemplate>[0]
}

/** Create deal room (RiftTransaction) for UGC. Does not fund; call applyContractTemplate then fund. */
export async function createDealRoom(input: CreateDealRoomInput): Promise<{ riftId: string; riftNumber: number }> {
  const currency = input.currency ?? 'CAD'
  const riftNumber = await generateNextRiftNumber()
  const buyerFee = calculateBuyerFee(input.totalAmount)
  const sellerFee = calculateSellerFee(input.totalAmount)
  const sellerNet = calculateSellerNet(input.totalAmount)
  const now = new Date()

  const rift = await prisma.riftTransaction.create({
    data: {
      id: crypto.randomUUID(),
      updatedAt: now,
      riftNumber,
      itemTitle: input.itemTitle,
      itemDescription: input.itemDescription,
      itemType: 'SERVICES',
      subtotal: input.totalAmount,
      amount: input.totalAmount,
      buyerFee,
      sellerFee,
      sellerNet,
      currency,
      buyerId: input.brandId,
      sellerId: input.creatorId,
      status: 'AWAITING_PAYMENT',
      allowsPartialRelease: true,
      milestones: undefined, // UGC uses Milestone table
    },
  })

  await logDealTimelineEvent(rift.id, 'MILESTONE_CREATED', null, { note: 'Deal room created' })
  return { riftId: rift.id, riftNumber }
}

/** Apply UGC contract template to deal; creates Contract and optionally milestones. */
export async function applyContractTemplate(
  riftId: string,
  templateId: string,
  overrides?: Parameters<typeof buildUGCContractFromTemplate>[0]
): Promise<{ contractId: string }> {
  if (templateId !== 'ugc_creation_v1') {
    throw new Error(`Unknown template: ${templateId}`)
  }

  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: { Contract: true },
  })
  if (!rift) throw new Error('Deal not found')
  if (rift.Contract) throw new Error('Deal already has a contract')

  const contractJson = buildUGCContractFromTemplate(overrides) as unknown as object
  const now = new Date()

  const contract = await prisma.contract.create({
    data: {
      id: crypto.randomUUID(),
      riftId,
      contractJson,
      version: 1,
      status: 'ACTIVE',
      updatedAt: now,
    },
  })

  await logDealTimelineEvent(riftId, 'MILESTONE_UPDATED', null, { note: 'UGC contract applied' })
  return { contractId: contract.id }
}

/** Create Milestone rows from contract + default UGC template milestones. */
export async function createMilestonesFromContract(riftId: string): Promise<{ milestoneIds: string[] }> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: { Contract: true, Milestone: { orderBy: { index: 'asc' } } },
  })
  if (!rift) throw new Error('Deal not found')
  if (!rift.Contract) throw new Error('Apply contract template first')
  if (rift.Milestone.length > 0) throw new Error('Milestones already exist')

  const payload = rift.Contract.contractJson as unknown as UGCContractPayload
  const totalAmount = rift.subtotal
  const currency = payload.currency ?? rift.currency
  const acceptanceWindowDays = payload.acceptanceWindowDays ?? 3
  const baseDate = new Date()

  const ids: string[] = []
  for (let i = 0; i < UGC_DEFAULT_MILESTONES.length; i++) {
    const tmpl: UGCTemplateMilestone = UGC_DEFAULT_MILESTONES[i]
    const amount = Math.round((totalAmount * tmpl.amountPercent) / 100 * 100) / 100
    const dueAt = new Date(baseDate)
    dueAt.setDate(dueAt.getDate() + tmpl.dueDateOffsetDays)

    const milestone = await prisma.milestone.create({
      data: {
        id: crypto.randomUUID(),
        riftId,
        index: i,
        title: tmpl.title,
        description: tmpl.description,
        amount,
        currency,
        dueAt,
        acceptanceWindowDays: tmpl.acceptanceWindowDays,
        autoApprove: tmpl.autoApprove,
        status: MilestoneStatus.PENDING_FUNDING,
        maxRevisions: tmpl.maxRevisions,
        updatedAt: new Date(),
      },
    })
    ids.push(milestone.id)
    await logDealTimelineEvent(riftId, 'MILESTONE_CREATED', null, {
      milestoneId: milestone.id,
      milestoneIndex: i,
      title: milestone.title,
      amount,
    })
  }

  return { milestoneIds: ids }
}

/** Call after deal is funded (payment received): record ESCROW_FUND and mark all UGC milestones funded. */
export async function onDealFunded(riftId: string): Promise<void> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: { Contract: true, Milestone: { orderBy: { index: 'asc' } } },
  })
  if (!rift || !rift.fundedAt || !rift.Contract || rift.Milestone.length === 0) return
  const pending = rift.Milestone.filter((m) => m.status === 'PENDING_FUNDING')
  if (pending.length === 0) return

  const { recordLedgerTransaction } = await import('@/lib/ugc/ledger')
  const { fundMilestone } = await import('@/lib/ugc/milestones')

  await recordLedgerTransaction(riftId, 'ESCROW_FUND', rift.subtotal, rift.currency)
  for (const m of pending) {
    await fundMilestone(m.id)
  }
}
