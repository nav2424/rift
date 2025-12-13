/**
 * Wallet and ledger management for Rift
 * Handles internal wallet accounts and immutable ledger entries
 */

import { prisma } from './prisma'
import { WalletLedgerType } from '@prisma/client'

/**
 * Get or create wallet account for a user
 */
export async function getOrCreateWalletAccount(
  userId: string,
  currency: string = 'CAD'
): Promise<{ id: string; availableBalance: number; pendingBalance: number }> {
  let wallet = await prisma.walletAccount.findUnique({
    where: { userId },
  })

  if (!wallet) {
    wallet = await prisma.walletAccount.create({
      data: {
        userId,
        currency,
        availableBalance: 0,
        pendingBalance: 0,
      },
    })
  }

  return wallet
}

/**
 * Credit seller's available balance when funds are released
 * Creates a ledger entry and updates wallet balance
 */
export async function creditSellerOnRelease(
  riftId: string,
  sellerId: string,
  amount: number,
  currency: string = 'CAD',
  metadata?: Record<string, any>
): Promise<void> {
  const wallet = await getOrCreateWalletAccount(sellerId, currency)

  // Use transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    // Create ledger entry
    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: wallet.id,
        type: WalletLedgerType.CREDIT_RELEASE,
        amount,
        currency,
        relatedRiftId: riftId,
        metadata: metadata || {},
      },
    })

    // Update wallet balance
    await tx.walletAccount.update({
      where: { id: wallet.id },
      data: {
        availableBalance: {
          increment: amount,
        },
      },
    })
  })
}

/**
 * Debit seller's wallet for withdrawal
 * Creates a ledger entry and updates wallet balance
 */
export async function debitSellerOnWithdrawal(
  userId: string,
  amount: number,
  currency: string = 'CAD',
  metadata?: Record<string, any>
): Promise<void> {
  const wallet = await getOrCreateWalletAccount(userId, currency)

  if (wallet.availableBalance < amount) {
    throw new Error('Insufficient available balance')
  }

  await prisma.$transaction(async (tx) => {
    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: wallet.id,
        type: WalletLedgerType.DEBIT_WITHDRAWAL,
        amount: -amount, // Negative for debit
        currency,
        metadata: metadata || {},
      },
    })

    await tx.walletAccount.update({
      where: { id: wallet.id },
      data: {
        availableBalance: {
          decrement: amount,
        },
      },
    })
  })
}

/**
 * Debit seller's wallet for chargeback
 * Can create negative balance if insufficient funds
 */
export async function debitSellerOnChargeback(
  riftId: string,
  sellerId: string,
  amount: number,
  currency: string = 'CAD',
  metadata?: Record<string, any>
): Promise<void> {
  const wallet = await getOrCreateWalletAccount(sellerId, currency)

  await prisma.$transaction(async (tx) => {
    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: wallet.id,
        type: WalletLedgerType.DEBIT_CHARGEBACK,
        amount: -amount,
        currency,
        relatedRiftId: riftId,
        metadata: metadata || {},
      },
    })

    // Allow negative balance for chargebacks
    await tx.walletAccount.update({
      where: { id: wallet.id },
      data: {
        availableBalance: {
          decrement: amount,
        },
      },
    })
  })
}

/**
 * Debit seller's wallet for refund
 */
export async function debitSellerOnRefund(
  riftId: string,
  sellerId: string,
  amount: number,
  currency: string = 'CAD',
  metadata?: Record<string, any>
): Promise<void> {
  const wallet = await getOrCreateWalletAccount(sellerId, currency)

  await prisma.$transaction(async (tx) => {
    await tx.walletLedgerEntry.create({
      data: {
        walletAccountId: wallet.id,
        type: WalletLedgerType.DEBIT_REFUND,
        amount: -amount,
        currency,
        relatedRiftId: riftId,
        metadata: metadata || {},
      },
    })

    // If insufficient balance, allow negative (debt)
    const newBalance = wallet.availableBalance - amount
    await tx.walletAccount.update({
      where: { id: wallet.id },
      data: {
        availableBalance: newBalance,
      },
    })
  })
}

/**
 * Get wallet balance and ledger for a user
 */
export async function getWalletBalance(userId: string) {
  const wallet = await getOrCreateWalletAccount(userId)
  
  const ledgerEntries = await prisma.walletLedgerEntry.findMany({
    where: { walletAccountId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: 50, // Last 50 entries
  })

  return {
    wallet,
    ledgerEntries,
  }
}

/**
 * Check if user can withdraw (has sufficient balance and is verified)
 */
export async function canUserWithdraw(userId: string): Promise<{
  canWithdraw: boolean
  reason?: string
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      emailVerified: true,
      phoneVerified: true,
      stripeConnectAccountId: true,
      stripeIdentityVerified: true,
    },
  })

  if (!user) {
    return { canWithdraw: false, reason: 'User not found' }
  }

  if (!user.emailVerified || !user.phoneVerified) {
    return { canWithdraw: false, reason: 'Email and phone must be verified' }
  }

  if (!user.stripeConnectAccountId) {
    return { canWithdraw: false, reason: 'Stripe Connect account not set up' }
  }

  if (!user.stripeIdentityVerified) {
    return { canWithdraw: false, reason: 'Stripe Identity verification not completed' }
  }

  const wallet = await getOrCreateWalletAccount(userId)
  if (wallet.availableBalance <= 0) {
    return { canWithdraw: false, reason: 'Insufficient available balance' }
  }

  return { canWithdraw: true }
}
