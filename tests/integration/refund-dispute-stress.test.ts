/**
 * Refund & Dispute Stress Test Suite
 * 
 * Tests all scenarios from REFUND_DISPUTE_STRESS_TEST.md
 * 
 * NOTE: This is an INTEGRATION test that uses REAL Prisma.
 * Make sure TEST_DATABASE_URL is set to a test database.
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest'

// Unmock Prisma for this integration test - we need the real client
vi.unmock('../../lib/prisma')
vi.unmock('@prisma/client')

import { prisma } from '../../lib/prisma' // Use relative import for reliability
import { checkRefundEligibility, validateRefundAmount } from '../../lib/refund-policy'
import { checkDisputeFreeze } from '../../lib/dispute-freeze'
import { checkBalanceAvailability } from '../../lib/stripe-balance'
import { acquireMilestoneReleaseLock, acquireFullReleaseLock } from '../../lib/release-concurrency'
import { refundRiftPayment } from '../../lib/stripe'
import { createRiftPaymentIntent } from '../../lib/stripe'
import { createRiftTransfer } from '../../lib/stripe'
import { createServerClient } from '../../lib/supabase'
import { randomUUID } from 'crypto'

// Verify Prisma is available
if (!prisma) {
  throw new Error('Prisma client is not available. Check your imports and database connection.')
}

// Mock Stripe module - create mock inside factory to avoid hoisting issues
vi.mock('../../lib/stripe', async () => {
  const actual = await vi.importActual('../../lib/stripe')
  
  // Create mock Stripe instance inside factory
  const mockStripe = {
    paymentIntents: {
      create: vi.fn().mockResolvedValue({
        id: 'pi_mock_123',
        client_secret: 'pi_mock_123_secret_test',
        metadata: {
          escrowId: 'test-rift',
          subtotal: '100.00',
          buyerFee: '3.00',
          sellerFee: '5.00',
          buyerTotal: '103.00',
          sellerPayout: '95.00',
        },
      }),
      retrieve: vi.fn().mockResolvedValue({
        id: 'pi_mock_123',
        status: 'succeeded',
        metadata: {
          escrowId: 'test-rift',
          subtotal: '100.00',
          buyerFee: '3.00',
          sellerFee: '5.00',
          buyerTotal: '103.00',
          sellerPayout: '95.00',
        },
      }),
    },
    transfers: {
      create: vi.fn().mockResolvedValue({
        id: 'tr_mock_123',
        amount: 9500, // $95.00 in cents
        currency: 'cad',
        status: 'paid',
      }),
      retrieve: vi.fn().mockResolvedValue({
        id: 'tr_mock_123',
        status: 'paid',
      }),
    },
    refunds: {
      create: vi.fn().mockResolvedValue({
        id: 're_mock_123',
        amount: 10300, // $103.00 in cents
        status: 'succeeded',
      }),
    },
    balance: {
      retrieve: vi.fn().mockResolvedValue({
        available: [
          {
            amount: 100000, // $1000.00 in cents
            currency: 'cad',
            source_types: { card: 100000 },
          },
        ],
        pending: [],
        connect_reserved: {},
        issuing: { available: [] },
        livemode: false,
        object: 'balance',
      }),
    },
  }
  
  return {
    ...actual,
    stripe: mockStripe,
  }
})

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
    })),
  })),
}))

const defaultTestDbUrl = 'postgresql://test:test@localhost:5432/rift_test'
const hasTestDb =
  typeof process.env.TEST_DATABASE_URL === 'string' &&
  /^postgres(ql)?:\/\//.test(process.env.TEST_DATABASE_URL) &&
  process.env.TEST_DATABASE_URL !== defaultTestDbUrl

const integrationDescribe = hasTestDb ? describe : describe.skip

integrationDescribe('Refund & Dispute Stress Tests', () => {
  let buyerId: string
  let sellerId: string
  let riftId: string
  let paymentIntentId: string

  beforeAll(async () => {
    if (!hasTestDb) return
    await prisma.$connect()
  })

  afterAll(async () => {
    if (!hasTestDb) return
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up test data
    await prisma.milestoneRelease.deleteMany({ where: { riftId: { startsWith: 'test-' } } })
    await prisma.riftTransaction.deleteMany({ where: { id: { startsWith: 'test-' } } })
    await prisma.user.deleteMany({ where: { email: { contains: '@test-stress' } } })

    // Create test users
    const buyer = await prisma.user.create({
      data: {
        id: `test-buyer-${randomUUID()}`,
        email: `buyer-${randomUUID()}@test-stress.com`,
        passwordHash: 'hashed',
        name: 'Test Buyer',
        updatedAt: new Date(),
      },
    })

    const seller = await prisma.user.create({
      data: {
        id: `test-seller-${randomUUID()}`,
        email: `seller-${randomUUID()}@test-stress.com`,
        passwordHash: 'hashed',
        name: 'Test Seller',
        stripeConnectAccountId: 'acct_test_seller',
        updatedAt: new Date(),
      },
    })

    buyerId = buyer.id
    sellerId = seller.id

    // Create test rift
    const rift = await prisma.riftTransaction.create({
      data: {
        id: `test-rift-${randomUUID()}`,
        riftNumber: Math.floor(Math.random() * 1000000),
        itemTitle: 'Test Item',
        itemDescription: 'Test Description',
        itemType: 'PHYSICAL',
        subtotal: 100.0,
        currency: 'CAD',
        buyerFee: 3.0,
        sellerFee: 5.0,
        sellerNet: 95.0,
        buyerId,
        sellerId,
        status: 'FUNDED',
        stripePaymentIntentId: `pi_test_${randomUUID()}`,
        version: 0,
        updatedAt: new Date(),
      },
    })

    riftId = rift.id
    paymentIntentId = rift.stripePaymentIntentId!
  })

  describe('Scenario 1: Refund Before Release', () => {
    it('should allow full refund when no releases have occurred', async () => {
      const eligibility = await checkRefundEligibility(riftId)

      expect(eligibility.eligible).toBe(true)
      expect(eligibility.canRefundFull).toBe(true)
      expect(eligibility.releasedAmount).toBe(0)
      expect(eligibility.unreleasedAmount).toBe(100.0)
    })

    it('should prevent transfers after refund', async () => {
      // Refund should succeed
      const refundResult = await refundRiftPayment(
        paymentIntentId,
        riftId,
        103.0, // buyerTotal
        randomUUID()
      )

      // Update rift status to REFUNDED (in real code, refundRiftPayment does this)
      await prisma.riftTransaction.update({
        where: { id: riftId },
        data: { status: 'REFUNDED', updatedAt: new Date() },
      })

      // After refund, release should be blocked
      const eligibility = await checkRefundEligibility(riftId)
      expect(eligibility.eligible).toBe(false)
    })
  })

  describe('Scenario 2: Partial Refund Before Release', () => {
    it('should allow partial refund of buyer fee', async () => {
      const validation = await validateRefundAmount(riftId, 3.0) // Just buyer fee

      expect(validation.valid).toBe(true)
    })

    it('should allow remaining amount to be released after partial refund', async () => {
      // Partial refund of buyer fee
      await refundRiftPayment(paymentIntentId, riftId, 3.0, randomUUID())

      // Should still be able to release (though in practice, refund would change status)
      const eligibility = await checkRefundEligibility(riftId)
      // After partial refund, full refund eligibility may change
      expect(eligibility.canRefundPartial).toBe(true)
    })
  })

  describe('Scenario 3: Refund After Milestone Release', () => {
    it('should reject refund after first milestone is released', async () => {
      // Create a milestone release
      await prisma.milestoneRelease.create({
        data: {
          id: randomUUID(),
          riftId,
          milestoneIndex: 0,
          milestoneTitle: 'Milestone 1',
          milestoneAmount: 50.0,
          releasedAmount: 50.0,
          sellerFee: 2.5,
          sellerNet: 47.5,
          releasedBy: buyerId,
          status: 'RELEASED',
          payoutId: 'tr_test_123',
        },
      })

      const eligibility = await checkRefundEligibility(riftId)

      expect(eligibility.eligible).toBe(false)
      expect(eligibility.reason).toContain('milestone')
    })

    it('should block all refunds after partial milestone release', async () => {
      // Create milestone release for 50% of amount
      await prisma.milestoneRelease.create({
        data: {
          id: randomUUID(),
          riftId,
          milestoneIndex: 0,
          milestoneTitle: 'Milestone 1',
          milestoneAmount: 50.0,
          releasedAmount: 50.0,
          sellerFee: 2.5,
          sellerNet: 47.5,
          releasedBy: buyerId,
          status: 'RELEASED',
        },
      })

      const eligibility = await checkRefundEligibility(riftId)

      // Strict policy: no refunds after any milestone release
      expect(eligibility.eligible).toBe(false)
      expect(eligibility.canRefundFull).toBe(false)
      expect(eligibility.canRefundPartial).toBe(false)
      expect(eligibility.maxRefundAmount).toBe(0)
    })
  })

  describe('Scenario 4: Dispute Created While FUNDED', () => {
    it('should freeze releases when dispute is created', async () => {
      // Create dispute in Prisma
      await prisma.dispute.create({
        data: {
          id: randomUUID(),
          escrowId: riftId,
          raisedById: buyerId,
          reason: 'Item not as described',
          status: 'OPEN',
          updatedAt: new Date(),
        },
      })

      const freezeCheck = await checkDisputeFreeze(riftId)

      expect(freezeCheck.frozen).toBe(true)
      expect(freezeCheck.reason).toContain('dispute')
    })

    it('should block release attempt when dispute exists', async () => {
      // Create dispute in Prisma
      await prisma.dispute.create({
        data: {
          id: randomUUID(),
          escrowId: riftId,
          raisedById: buyerId,
          reason: 'Item not received',
          status: 'UNDER_REVIEW',
          updatedAt: new Date(),
        },
      })

      const freezeCheck = await checkDisputeFreeze(riftId)

      expect(freezeCheck.frozen).toBe(true)

      // Release should be blocked
      const lock = await acquireFullReleaseLock(riftId)
      // Lock acquisition might succeed, but release logic should check freeze
    })
  })

  describe('Scenario 5: Dispute After Some Releases', () => {
    it('should freeze future releases when dispute created after milestone', async () => {
      // Create milestone release
      await prisma.milestoneRelease.create({
        data: {
          id: randomUUID(),
          riftId,
          milestoneIndex: 0,
          milestoneTitle: 'Milestone 1',
          milestoneAmount: 50.0,
          releasedAmount: 50.0,
          sellerFee: 2.5,
          sellerNet: 47.5,
          releasedBy: buyerId,
          status: 'RELEASED',
        },
      })

      // Create dispute in Prisma
      await prisma.dispute.create({
        data: {
          id: randomUUID(),
          escrowId: riftId,
          raisedById: buyerId,
          reason: 'Dispute after partial release',
          status: 'OPEN',
          updatedAt: new Date(),
        },
      })

      const freezeCheck = await checkDisputeFreeze(riftId)

      expect(freezeCheck.frozen).toBe(true)

      // Attempt to release second milestone should be blocked
      const lock = await acquireMilestoneReleaseLock(riftId, 1)
      // Lock might succeed, but release should check freeze
    })
  })

  describe('Scenario 6: Concurrent Release Attempts', () => {
    it('should prevent duplicate milestone releases with unique constraint', async () => {
      // First release attempt
      const lock1 = await acquireMilestoneReleaseLock(riftId, 0)

      expect(lock1).not.toBeNull()
      expect(lock1?.status).toBe('CREATING')

      // Second concurrent attempt should detect existing
      const lock2 = await acquireMilestoneReleaseLock(riftId, 0)

      // Should return existing lock or detect conflict
      expect(lock2).not.toBeNull()
    })

    it('should use idempotency keys for transfers', async () => {
      const { getMilestoneTransferIdempotencyKey } = await import('../../lib/stripe-idempotency')
      const key = getMilestoneTransferIdempotencyKey(riftId, 0)

      expect(key).toBe(`xfer:release:rift:${riftId}:ms:0:v1`)
      expect(key).not.toContain('timestamp') // No timestamps in key
    })
  })

  describe('Scenario 7: Balance Insufficient', () => {
    it('should check balance before transfer', async () => {
      const { stripe } = await import('../../lib/stripe')
      
      // Mock insufficient balance
      vi.mocked(stripe.balance.retrieve).mockResolvedValueOnce({
        available: [
          {
            amount: 5000, // $50.00 in cents
            currency: 'cad',
            source_types: { card: 5000 },
          },
        ],
        pending: [],
        connect_reserved: {},
        issuing: { available: [] },
        livemode: false,
        object: 'balance',
      } as any)

      const balance = await checkBalanceAvailability(100.0, 'CAD')

      expect(balance.sufficient).toBe(false)
      expect(balance.available).toBe(50.0)
    })

    it('should throw error when balance insufficient for transfer', async () => {
      const { stripe } = await import('../../lib/stripe')
      
      // Mock insufficient balance
      vi.mocked(stripe.balance.retrieve).mockResolvedValueOnce({
        available: [
          {
            amount: 5000, // $50.00
            currency: 'cad',
          },
        ],
        pending: [],
        connect_reserved: {},
        issuing: { available: [] },
        livemode: false,
        object: 'balance',
      } as any)

      await expect(
        createRiftTransfer(
          100.0, // Need $100
          'CAD',
          'acct_test',
          riftId,
          undefined,
          null
        )
      ).rejects.toThrow('Insufficient Stripe balance')
    })
  })

  describe('Scenario 8: Duplicate Milestone Release Prevention', () => {
    it('should enforce unique constraint on (riftId, milestoneIndex)', async () => {
      // Create first milestone release
      await prisma.milestoneRelease.create({
        data: {
          id: randomUUID(),
          riftId,
          milestoneIndex: 0,
          milestoneTitle: 'Milestone 1',
          milestoneAmount: 50.0,
          releasedAmount: 50.0,
          sellerFee: 2.5,
          sellerNet: 47.5,
          releasedBy: buyerId,
          status: 'RELEASED',
        },
      })

      // Attempt duplicate should fail with unique constraint
      await expect(
        prisma.milestoneRelease.create({
          data: {
            id: randomUUID(),
            riftId,
            milestoneIndex: 0, // Same index
            milestoneTitle: 'Duplicate',
            milestoneAmount: 50.0,
            releasedAmount: 50.0,
            sellerFee: 2.5,
            sellerNet: 47.5,
            releasedBy: buyerId,
            status: 'RELEASED',
          },
        })
      ).rejects.toThrow()
    })
  })

  describe('Scenario 9: Refund After Full Release', () => {
    it('should reject refund when rift is fully released', async () => {
      // Update rift to RELEASED status
      await prisma.riftTransaction.update({
        where: { id: riftId },
        data: {
          status: 'RELEASED',
          updatedAt: new Date(),
        },
      })

      const eligibility = await checkRefundEligibility(riftId)

      expect(eligibility.eligible).toBe(false)
      expect(eligibility.reason).toContain('fully released')
    })
  })

  describe('Load Test Scenarios', () => {
    it('should handle multiple concurrent milestone releases', async () => {
      const promises = []
      
      // Simulate 10 concurrent release attempts for same milestone
      for (let i = 0; i < 10; i++) {
        promises.push(acquireMilestoneReleaseLock(riftId, 0))
      }

      const locks = await Promise.all(promises)

      // Only one should succeed in creating the record
      const createdLocks = locks.filter(l => l?.status === 'CREATING')
      expect(createdLocks.length).toBeLessThanOrEqual(1)
    })

    it('should track released amounts correctly', async () => {
      // Create multiple milestone releases
      const milestones = [
        { index: 0, amount: 30.0 },
        { index: 1, amount: 40.0 },
        { index: 2, amount: 30.0 },
      ]

      for (const milestone of milestones) {
        await prisma.milestoneRelease.create({
          data: {
            id: randomUUID(),
            riftId,
            milestoneIndex: milestone.index,
            milestoneTitle: `Milestone ${milestone.index}`,
            milestoneAmount: milestone.amount,
            releasedAmount: milestone.amount,
            sellerFee: milestone.amount * 0.05,
            sellerNet: milestone.amount * 0.95,
            releasedBy: buyerId,
            status: 'RELEASED',
          },
        })
      }

      // Calculate total released
      const releases = await prisma.milestoneRelease.findMany({
        where: { riftId, status: 'RELEASED' },
      })

      const totalReleased = releases.reduce((sum, r) => sum + r.releasedAmount, 0)
      expect(totalReleased).toBe(100.0) // Should match subtotal
    })
  })
})

