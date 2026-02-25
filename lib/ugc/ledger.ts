/**
 * UGC deal ledger: escrow balance view and ledger transactions for releases/refunds.
 */

import { prisma } from '@/lib/prisma'
import type { LedgerTransactionType } from '@prisma/client'

export async function recordLedgerTransaction(
  riftId: string,
  type: LedgerTransactionType,
  amount: number,
  currency: string,
  options: {
    milestoneId?: string
    status?: string
    metadata?: Record<string, unknown>
  } = {}
): Promise<void> {
  await prisma.ledgerTransaction.create({
    data: {
      id: crypto.randomUUID(),
      riftId,
      milestoneId: options.milestoneId ?? undefined,
      type,
      amount,
      currency,
      status: options.status ?? 'COMPLETED',
      metadata: options.metadata ? (options.metadata as object) : undefined,
    },
  })
}

/** Sum of ESCROW_FUND minus RELEASE/REFUND/SPLIT for a deal (conceptual escrow balance). */
export async function getEscrowBalanceForDeal(riftId: string): Promise<{ totalFunded: number; totalReleased: number; balance: number; currency: string }> {
  const txns = await prisma.ledgerTransaction.findMany({
    where: { riftId },
    select: { type: true, amount: true, currency: true },
  })
  let totalFunded = 0
  let totalReleased = 0
  let currency = 'CAD'
  for (const t of txns) {
    if (t.currency) currency = t.currency
    if (t.type === 'ESCROW_FUND') totalFunded += t.amount
    if (t.type === 'RELEASE_TO_CREATOR' || t.type === 'REFUND_TO_BRAND' || t.type === 'SPLIT_RELEASE' || t.type === 'KILL_FEE_RELEASE') totalReleased += t.amount
  }
  return { totalFunded, totalReleased, balance: totalFunded - totalReleased, currency }
}
