/**
 * Contract amendments (v1): limited scope changes that require both parties to accept.
 */

import { prisma } from '@/lib/prisma'
import { logDealTimelineEvent } from '@/lib/ugc/timeline'

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'deliverables',
  'deadlines',
  'revisions',
  'usageRights',
  'whitelisting',
  'acceptanceWindowDays',
  'killFeePercent',
  'currency',
])

export function validateAmendmentPatch(patchJson: Record<string, unknown>): void {
  const keys = Object.keys(patchJson || {})
  if (keys.length === 0) throw new Error('patchJson cannot be empty')
  for (const k of keys) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(k)) {
      throw new Error(`Patch key not allowed in v1: ${k}`)
    }
  }
}

export async function proposeAmendment(riftId: string, proposedById: string, patchJson: Record<string, unknown>) {
  validateAmendmentPatch(patchJson)
  const rift = await prisma.riftTransaction.findUnique({ where: { id: riftId }, include: { Contract: true } })
  if (!rift?.Contract) throw new Error('No contract to amend')
  if (rift.buyerId !== proposedById && rift.sellerId !== proposedById) throw new Error('Forbidden')

  // v1 guardrail: if funded, forbid changing money/milestones via amendments (we only allow contract terms).
  if (rift.fundedAt) {
    if ((patchJson as any).milestones || (patchJson as any).amounts) {
      throw new Error('Milestone changes after funding require admin review (not supported in v1)')
    }
  }

  const amendment = await prisma.contractAmendment.create({
    data: {
      id: crypto.randomUUID(),
      riftId,
      proposedById,
      patchJson: patchJson as any,
      status: 'PENDING',
      updatedAt: new Date(),
    },
  })

  await logDealTimelineEvent(riftId, 'CONTRACT_AMENDMENT_PROPOSED', proposedById, { amendmentId: amendment.id })
  return amendment.id
}

export async function acceptAmendment(riftId: string, amendmentId: string, acceptedById: string) {
  const rift = await prisma.riftTransaction.findUnique({ where: { id: riftId }, include: { Contract: true } })
  if (!rift?.Contract) throw new Error('No contract')
  if (rift.buyerId !== acceptedById && rift.sellerId !== acceptedById) throw new Error('Forbidden')

  const amendment = await prisma.contractAmendment.findUnique({ where: { id: amendmentId } })
  if (!amendment || amendment.riftId !== riftId) throw new Error('Amendment not found')
  if (amendment.status !== 'PENDING') throw new Error('Amendment is not pending')
  if (amendment.proposedById === acceptedById) throw new Error('Other party must accept')

  const patchJson = amendment.patchJson as Record<string, unknown>
  validateAmendmentPatch(patchJson)

  const nextContract = {
    ...(rift.Contract.contractJson as Record<string, unknown>),
    ...patchJson,
  }

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: rift.Contract!.id },
      data: {
        contractJson: nextContract,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    })

    await tx.contractAmendment.update({
      where: { id: amendmentId },
      data: {
        status: 'ACCEPTED',
        acceptedById,
        acceptedAt: new Date(),
        updatedAt: new Date(),
      },
    })
  })

  await logDealTimelineEvent(riftId, 'CONTRACT_AMENDMENT_ACCEPTED', acceptedById, { amendmentId })
}

export async function rejectAmendment(riftId: string, amendmentId: string, rejectedById: string) {
  const rift = await prisma.riftTransaction.findUnique({ where: { id: riftId }, select: { buyerId: true, sellerId: true } })
  if (!rift) throw new Error('Deal not found')
  if (rift.buyerId !== rejectedById && rift.sellerId !== rejectedById) throw new Error('Forbidden')

  const amendment = await prisma.contractAmendment.findUnique({ where: { id: amendmentId } })
  if (!amendment || amendment.riftId !== riftId) throw new Error('Amendment not found')
  if (amendment.status !== 'PENDING') throw new Error('Amendment is not pending')

  await prisma.contractAmendment.update({
    where: { id: amendmentId },
    data: { status: 'REJECTED', updatedAt: new Date() },
  })

  await logDealTimelineEvent(riftId, 'CONTRACT_AMENDMENT_REJECTED', rejectedById, { amendmentId })
}

