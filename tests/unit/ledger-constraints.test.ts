/**
 * Ledger Constraints Tests
 * Ensures wallet balance and payout operations maintain invariants:
 * - Wallet balance cannot go below 0
 * - Payout cannot exceed available balance
 * - Concurrent withdrawal attempts are handled safely
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { debitSellerOnWithdrawal, creditSellerOnRelease, getOrCreateWalletAccount } from '@/lib/wallet'

// Mock Prisma Client with WalletLedgerType
vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual('@prisma/client')
  return {
    ...actual,
    WalletLedgerType: {
      CREDIT_RELEASE: 'CREDIT_RELEASE',
      DEBIT_WITHDRAWAL: 'DEBIT_WITHDRAWAL',
      DEBIT_CHARGEBACK: 'DEBIT_CHARGEBACK',
      DEBIT_REFUND: 'DEBIT_REFUND',
    },
  }
})

// Mock dependencies
vi.mock('@/lib/prisma', () => {
  const walletAccount = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
  const walletLedgerEntry = {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
  }

  return {
    prisma: {
      walletAccount,
      walletLedgerEntry,
      $transaction: vi.fn(async (callback) => {
        return callback({ walletAccount, walletLedgerEntry })
      }),
    },
  }
})

describe('Ledger Constraints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Wallet Balance Cannot Go Negative', () => {
    it('should prevent withdrawal when balance is insufficient', async () => {
      const userId = 'user-123'
      const wallet = {
        id: 'wallet-123',
        userId,
        availableBalance: 50.00, // Only $50 available
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)

      // Try to withdraw $100 when only $50 available
      await expect(
        debitSellerOnWithdrawal(userId, 100.00, 'CAD')
      ).rejects.toThrow('Insufficient available balance')

      // Should not create ledger entry
      expect(prisma.walletLedgerEntry.create).not.toHaveBeenCalled()
      // Should not update balance
      expect(prisma.walletAccount.update).not.toHaveBeenCalled()
    })

    it('should allow withdrawal when balance is sufficient', async () => {
      const userId = 'user-456'
      const wallet = {
        id: 'wallet-456',
        userId,
        availableBalance: 100.00,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)
      vi.mocked(prisma.walletAccount.update).mockResolvedValue({
        ...wallet,
        availableBalance: 0, // After withdrawal
      } as any)
      vi.mocked(prisma.walletLedgerEntry.create).mockResolvedValue({
        id: 'ledger-1',
        amount: -50.00,
      } as any)

      // Withdraw $50 when $100 available
      await debitSellerOnWithdrawal(userId, 50.00, 'CAD')

      // Should create ledger entry
      expect(prisma.walletLedgerEntry.create).toHaveBeenCalled()
      // Should update balance using decrement
      expect(prisma.$transaction).toHaveBeenCalled()
      // The transaction callback should update the balance
    })

    it('should prevent withdrawal when balance is exactly zero', async () => {
      const userId = 'user-zero'
      const wallet = {
        id: 'wallet-zero',
        userId,
        availableBalance: 0.00,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)

      // Try to withdraw any amount when balance is 0
      await expect(
        debitSellerOnWithdrawal(userId, 0.01, 'CAD')
      ).rejects.toThrow('Insufficient available balance')
    })

    it('should handle edge case: withdraw exact balance', async () => {
      const userId = 'user-exact'
      const exactBalance = 99.99
      const wallet = {
        id: 'wallet-exact',
        userId,
        availableBalance: exactBalance,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          walletAccount: {
            findUnique: vi.fn().mockResolvedValue(wallet as any),
            update: vi.fn().mockResolvedValue({
              ...wallet,
              availableBalance: 0,
            } as any),
          },
          walletLedgerEntry: {
            create: vi.fn().mockResolvedValue({
              id: 'ledger-1',
            } as any),
          },
        }
        return callback(tx)
      })

      // Withdraw exact balance
      await debitSellerOnWithdrawal(userId, exactBalance, 'CAD')

      // Should succeed and result in zero balance
      expect(prisma.$transaction).toHaveBeenCalled()
      // Transaction should update balance using decrement
    })
  })

  describe('Payout Cannot Exceed Available Balance', () => {
    it('should prevent payout exceeding available balance', async () => {
      const userId = 'user-payout'
      const availableBalance = 200.00
      const wallet = {
        id: 'wallet-payout',
        userId,
        availableBalance,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)

      // Try to withdraw more than available
      await expect(
        debitSellerOnWithdrawal(userId, availableBalance + 0.01, 'CAD')
      ).rejects.toThrow('Insufficient available balance')
    })

    it('should allow payout equal to available balance', async () => {
      const userId = 'user-payout-equal'
      const availableBalance = 150.00
      const wallet = {
        id: 'wallet-payout-equal',
        userId,
        availableBalance,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          walletAccount: {
            findUnique: vi.fn().mockResolvedValue(wallet as any),
            update: vi.fn().mockResolvedValue({
              ...wallet,
              availableBalance: 0,
            } as any),
          },
          walletLedgerEntry: {
            create: vi.fn().mockResolvedValue({
              id: 'ledger-1',
            } as any),
          },
        }
        return callback(tx)
      })

      await debitSellerOnWithdrawal(userId, availableBalance, 'CAD')

      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('Concurrent Withdrawal Attempts', () => {
    it('should handle concurrent withdrawal attempts safely', async () => {
      const userId = 'user-concurrent'
      const initialBalance = 100.00
      const wallet = {
        id: 'wallet-concurrent',
        userId,
        availableBalance: initialBalance,
        pendingBalance: 0,
        currency: 'CAD',
      }

      // Simulate concurrent withdrawals
      let balance = initialBalance
      let updateCount = 0

      vi.mocked(prisma.walletAccount.findUnique).mockImplementation(async () => ({
        ...wallet,
        availableBalance: balance,
      } as any))
      
      // Mock transaction to simulate concurrent withdrawals
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        updateCount++
        const tx = {
          walletAccount: {
            findUnique: vi.fn().mockResolvedValue({
              ...wallet,
              availableBalance: balance,
            } as any),
            update: vi.fn().mockImplementation(async (args: any) => {
              const decrement = Math.abs(args.data.availableBalance.decrement || 0)
              
              if (balance < decrement) {
                throw new Error('Insufficient available balance')
              }
              
              balance -= decrement
              return {
                ...wallet,
                availableBalance: balance,
              } as any
            }),
          },
          walletLedgerEntry: {
            create: vi.fn().mockResolvedValue({
              id: `ledger-${updateCount}`,
            } as any),
          },
        }
        return callback(tx)
      })

      // Try to withdraw $60 twice concurrently (total $120, but only $100 available)
      const withdrawal1 = debitSellerOnWithdrawal(userId, 60.00, 'CAD')
      const withdrawal2 = debitSellerOnWithdrawal(userId, 60.00, 'CAD')

      const results = await Promise.allSettled([withdrawal1, withdrawal2])

      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled')
      expect(successful.length).toBeGreaterThan(0)

      // At least one should fail due to insufficient balance
      const failed = results.filter(r => r.status === 'rejected')
      expect(failed.length).toBeGreaterThan(0)

      // Final balance should not be negative
      expect(balance).toBeGreaterThanOrEqual(0)
    })

    it('should use database transactions to prevent race conditions', async () => {
      const userId = 'user-transaction'
      const wallet = {
        id: 'wallet-transaction',
        userId,
        availableBalance: 100.00,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)

      // Mock transaction to ensure atomicity
      let transactionExecuted = false
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        if (transactionExecuted) {
          throw new Error('Concurrent transaction detected')
        }
        transactionExecuted = true
        const tx = {
          walletAccount: {
            findUnique: vi.fn().mockResolvedValue(wallet as any),
            update: vi.fn().mockResolvedValue({
              ...wallet,
              availableBalance: 50.00,
            } as any),
          },
          walletLedgerEntry: {
            create: vi.fn().mockResolvedValue({ id: 'ledger-1' } as any),
          },
        }
        return callback(tx)
      })

      await debitSellerOnWithdrawal(userId, 50.00, 'CAD')

      // Should use transaction
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('Balance Calculation Accuracy', () => {
    it('should maintain accurate balance after multiple operations', async () => {
      const userId = 'user-accuracy'
      let balance = 0.00
      const wallet = {
        id: 'wallet-accuracy',
        userId,
        availableBalance: balance,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)
      
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          walletAccount: {
            findUnique: vi.fn().mockResolvedValue({
              ...wallet,
              availableBalance: balance,
            } as any),
            update: vi.fn().mockImplementation(async (args: any) => {
              const increment = args.data.availableBalance.increment || 0
              const decrement = args.data.availableBalance.decrement || 0
              balance += increment
              balance -= decrement
              return {
                ...wallet,
                availableBalance: balance,
              } as any
            }),
          },
          walletLedgerEntry: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'ledger-1',
            } as any),
          },
        }
        return callback(tx)
      })

      // Credit $100
      await creditSellerOnRelease('rift-1', userId, 100.00, 'CAD')
      expect(balance).toBe(100.00)

      // Credit $50
      await creditSellerOnRelease('rift-2', userId, 50.00, 'CAD')
      expect(balance).toBe(150.00)

      // Debit $75
      await debitSellerOnWithdrawal(userId, 75.00, 'CAD')
      expect(balance).toBe(75.00)

      // Final balance should be correct
      expect(balance).toBe(75.00)
    })

    it('should handle fractional amounts correctly', async () => {
      const userId = 'user-fractional'
      const wallet = {
        id: 'wallet-fractional',
        userId,
        availableBalance: 0.01, // One cent
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)
      vi.mocked(prisma.walletAccount.update).mockResolvedValue({
        ...wallet,
        availableBalance: 0,
      } as any)
      vi.mocked(prisma.walletLedgerEntry.create).mockResolvedValue({
        id: 'ledger-1',
      } as any)

      // Withdraw one cent
      await debitSellerOnWithdrawal(userId, 0.01, 'CAD')

      expect(prisma.$transaction).toHaveBeenCalled()
      // Transaction should use decrement for withdrawal
    })
  })

  describe('Ledger Entry Atomicity', () => {
    it('should create ledger entry and update balance atomically', async () => {
      const userId = 'user-atomic'
      const wallet = {
        id: 'wallet-atomic',
        userId,
        availableBalance: 100.00,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)

      let ledgerCreated = false
      let balanceUpdated = false

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          walletAccount: {
            findUnique: vi.fn().mockResolvedValue(wallet as any),
            update: vi.fn().mockImplementation(async () => {
              balanceUpdated = true
              return { ...wallet, availableBalance: 50.00 } as any
            }),
          },
          walletLedgerEntry: {
            create: vi.fn().mockImplementation(async () => {
              ledgerCreated = true
              return { id: 'ledger-1' } as any
            }),
          },
        }
        const result = await callback(tx)
        return result
      })

      await debitSellerOnWithdrawal(userId, 50.00, 'CAD')

      // Both should happen in same transaction
      expect(ledgerCreated).toBe(true)
      expect(balanceUpdated).toBe(true)
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('should rollback on ledger entry creation failure', async () => {
      const userId = 'user-rollback'
      const wallet = {
        id: 'wallet-rollback',
        userId,
        availableBalance: 100.00,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          walletAccount: {
            findUnique: vi.fn().mockResolvedValue(wallet as any),
            update: vi.fn().mockResolvedValue({
              ...wallet,
              availableBalance: 50.00,
            } as any),
          },
          walletLedgerEntry: {
            create: vi.fn().mockRejectedValue(new Error('Database error')),
          },
        }
        try {
          return await callback(tx)
        } catch (error) {
          // Transaction should rollback on error
          throw error
        }
      })

      // Should fail and rollback
      await expect(
        debitSellerOnWithdrawal(userId, 50.00, 'CAD')
      ).rejects.toThrow('Database error')

      // Balance should not be updated (transaction rolled back)
      // In real implementation, Prisma transaction would handle this automatically
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large balance amounts', async () => {
      const userId = 'user-large'
      const largeBalance = 999999.99
      const wallet = {
        id: 'wallet-large',
        userId,
        availableBalance: largeBalance,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          walletAccount: {
            findUnique: vi.fn().mockResolvedValue(wallet as any),
            update: vi.fn().mockResolvedValue({
              ...wallet,
              availableBalance: largeBalance - 100.00,
            } as any),
          },
          walletLedgerEntry: {
            create: vi.fn().mockResolvedValue({ id: 'ledger-1' } as any),
          },
        }
        return callback(tx)
      })

      await debitSellerOnWithdrawal(userId, 100.00, 'CAD')

      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should handle zero amount withdrawal attempt', async () => {
      const userId = 'user-zero-amount'
      const wallet = {
        id: 'wallet-zero-amount',
        userId,
        availableBalance: 100.00,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          walletAccount: {
            findUnique: vi.fn().mockResolvedValue(wallet as any),
            update: vi.fn().mockResolvedValue(wallet as any),
          },
          walletLedgerEntry: {
            create: vi.fn().mockResolvedValue({ id: 'ledger-1' } as any),
          },
        }
        return callback(tx)
      })

      // Withdrawing zero should either be allowed or rejected
      // For now, test that it doesn't crash
      try {
        await debitSellerOnWithdrawal(userId, 0, 'CAD')
        // If allowed, should create ledger entry
        expect(prisma.$transaction).toHaveBeenCalled()
      } catch (error: any) {
        // If rejected, should throw appropriate error
        expect(error.message).toMatch(/amount/i)
      }
    })

    it('should handle negative amount withdrawal attempt', async () => {
      const userId = 'user-negative'
      const wallet = {
        id: 'wallet-negative',
        userId,
        availableBalance: 100.00,
        pendingBalance: 0,
        currency: 'CAD',
      }

      vi.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet as any)

      await expect(
        debitSellerOnWithdrawal(userId, -10.00, 'CAD')
      ).rejects.toThrow('Amount must be greater than 0')
    })
  })
})

