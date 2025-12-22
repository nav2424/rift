/**
 * Balance management for Rift
 * Handles instant in-app balance updates
 */

import { prisma } from './prisma'
import type { EscrowStatus } from '@prisma/client'

/**
 * Update seller balance when payment is received
 * Called when transaction status changes to AWAITING_SHIPMENT
 */
export async function updateBalanceOnPayment(transactionId: string) {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: transactionId },
    include: { seller: true },
  })

  if (!rift) {
    throw new Error('Transaction not found')
  }

  // Update seller's available balance
  await prisma.user.update({
    where: { id: rift.sellerId },
    data: {
      availableBalance: {
        increment: rift.amount ?? 0,
      },
      pendingBalance: {
        increment: rift.amount ?? 0,
      },
    },
  })
}

/**
 * Update balance when transaction is completed/released
 * Called when transaction status changes to RELEASED
 */
export async function updateBalanceOnRelease(transactionId: string) {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: transactionId },
    include: { seller: true },
  })

  if (!rift) {
    throw new Error('Transaction not found')
  }

  // Move from pending to processed
  await prisma.user.update({
    where: { id: rift.sellerId },
    data: {
      pendingBalance: {
        decrement: rift.amount ?? 0,
      },
      totalProcessedAmount: {
        increment: rift.amount ?? 0,
      },
      numCompletedTransactions: {
        increment: 1,
      },
    },
  })
}

/**
 * Rollback balance on refund/cancel
 */
export async function rollbackBalance(transactionId: string) {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: transactionId },
    include: { seller: true },
  })

  if (!rift) {
    throw new Error('Transaction not found')
  }

  // Rollback available balance if it was added
  if (rift.status === 'AWAITING_SHIPMENT' || rift.status === 'IN_TRANSIT') {
    await prisma.user.update({
      where: { id: rift.sellerId },
      data: {
        availableBalance: {
          decrement: rift.amount ?? 0,
        },
        pendingBalance: {
          decrement: rift.amount ?? 0,
        },
      },
    })
  }

  // If it was already released, rollback processed amount
  if (rift.status === 'RELEASED') {
    await prisma.user.update({
      where: { id: rift.sellerId },
      data: {
        totalProcessedAmount: {
          decrement: rift.amount ?? 0,
        },
        numCompletedTransactions: {
          decrement: 1,
        },
      },
    })
  }
}

/**
 * Recalculate user stats from all transactions
 * Useful for data integrity or migration
 */
export async function recalculateUserStats(userId: string) {
  // Get all completed transactions as seller
  const completedTransactions = await prisma.riftTransaction.findMany({
    where: {
      sellerId: userId,
      status: 'RELEASED',
    },
  })

  const totalProcessedAmount = completedTransactions.reduce(
    (sum: number, t: any) => sum + (t.amount ?? 0),
    0
  )
  const numCompletedTransactions = completedTransactions.length

  // Get all pending transactions
  const pendingTransactions = await prisma.riftTransaction.findMany({
    where: {
      sellerId: userId,
      status: {
        in: ['AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'],
      },
    },
  })

  const pendingBalance = pendingTransactions.reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0)

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      totalProcessedAmount,
      numCompletedTransactions,
      pendingBalance,
      // availableBalance is what user sees, can be same as pending for now
      // or can be calculated differently based on business logic
      availableBalance: pendingBalance,
    },
  })

  return {
    totalProcessedAmount,
    numCompletedTransactions,
    pendingBalance,
  }
}

