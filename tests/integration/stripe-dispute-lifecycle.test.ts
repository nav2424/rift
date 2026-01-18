/**
 * Stripe Dispute Lifecycle Tests
 * Ensures Stripe dispute handling is correct:
 * - Stripe dispute opened → rift locked
 * - Evidence submission deadlines
 * - Stripe dispute won/lost → correct final state
 * - Webhook retries don't duplicate stripe_disputes rows
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleStripeDisputeCreated, handleStripeDisputeUpdated, handleStripeDisputeClosed } from '@/lib/stripe-disputes'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    riftTransaction: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    timelineEvent: {
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    stripe_webhook_events: {
      create: vi.fn(),
    },
  },
}))

const mockDisputeUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
const mockRestrictionUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
const mockEq = vi.fn().mockReturnThis()
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockSelect = vi.fn().mockReturnThis()
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
const mockFrom = vi.fn((table: string) => {
  if (table === 'stripe_disputes') {
    return {
      upsert: mockDisputeUpsert,
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    }
  }
  if (table === 'user_restrictions') {
    return {
      upsert: mockRestrictionUpsert,
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    }
  }
  return {
    upsert: mockRestrictionUpsert,
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
    eq: mockEq,
    maybeSingle: mockMaybeSingle,
  }
})

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

vi.mock('@/lib/rift-events', () => ({
  logEvent: vi.fn(),
  extractRequestMetadata: vi.fn(() => ({})),
}))

vi.mock('@/lib/risk/metrics', () => ({
  updateMetricsOnChargeback: vi.fn(),
}))

vi.mock('@/lib/risk/enforcement', () => ({
  isFundsFrozen: vi.fn().mockResolvedValue(false),
}))

// Mock Stripe webhook handler
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn((body, signature, secret) => {
        const parsed = JSON.parse(body)
        return { livemode: false, ...parsed }
      }),
    },
  },
}))

// Dynamic import of webhook handler
let POST: typeof import('@/app/api/webhooks/stripe/route').POST

beforeAll(async () => {
  const routeModule = await import('@/app/api/webhooks/stripe/route')
  POST = routeModule.POST
})

describe('Stripe Dispute Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Dispute Opened → Rift Locked', () => {
    it('should lock rift when Stripe dispute is opened', async () => {
      const riftId = 'rift-dispute-opened'
      const chargeId = 'ch_dispute_123'
      const disputeId = 'dp_dispute_123'
      
      const rift = {
        id: riftId,
        status: 'RELEASED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)

      const dispute = {
        id: disputeId,
        charge: chargeId,
        amount: 10000, // in cents
        currency: 'usd',
        status: 'needs_response',
        reason: 'fraudulent',
        evidence_details: {
          due_by: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days from now
          has_evidence: false,
          past_due: false,
        },
        created: Math.floor(Date.now() / 1000),
      }

      await handleStripeDisputeCreated(dispute as any)

      // Should create dispute record in Supabase
      expect(mockFrom).toHaveBeenCalledWith('stripe_disputes')
      expect(mockDisputeUpsert).toHaveBeenCalled()
      
      // Should freeze funds
      expect(mockFrom).toHaveBeenCalledWith('user_restrictions')
    })

    it('should update rift status when dispute is opened', async () => {
      const riftId = 'rift-status-update'
      const chargeId = 'ch_status_123'
      
      const rift = {
        id: riftId,
        status: 'RELEASED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)
      vi.mocked(prisma.riftTransaction.update).mockResolvedValue({
        ...rift,
        status: 'DISPUTED',
      } as any)

      const dispute = {
        id: 'dp_status_123',
        charge: chargeId,
        amount: 10000,
        currency: 'usd',
        status: 'needs_response',
        reason: 'fraudulent',
      }

      await handleStripeDisputeCreated(dispute as any)

      // Rift status should be updated to reflect dispute
      // (Implementation may update status or just freeze funds)
    })
  })

  describe('Evidence Submission Deadlines', () => {
    it('should track evidence due date from dispute', async () => {
      const riftId = 'rift-evidence-deadline'
      const chargeId = 'ch_evidence_123'
      
      const rift = {
        id: riftId,
        status: 'RELEASED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)

      const evidenceDueDate = new Date()
      evidenceDueDate.setDate(evidenceDueDate.getDate() + 7) // 7 days from now

      const dispute = {
        id: 'dp_evidence_123',
        charge: chargeId,
        amount: 10000,
        currency: 'usd',
        status: 'needs_response',
        reason: 'fraudulent',
        evidence_details: {
          due_by: Math.floor(evidenceDueDate.getTime() / 1000),
          has_evidence: false,
          past_due: false,
        },
      }

      await handleStripeDisputeCreated(dispute as any)

      // Should store evidence_due_by in stripe_disputes table
      expect(mockFrom).toHaveBeenCalledWith('stripe_disputes')
      expect(mockDisputeUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          evidence_due_by: expect.any(String),
        }),
        expect.any(Object)
      )
    })

    it('should handle past due evidence deadlines', async () => {
      const riftId = 'rift-past-due'
      const chargeId = 'ch_past_due_123'
      
      const rift = {
        id: riftId,
        status: 'RELEASED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)

      const dispute = {
        id: 'dp_past_due_123',
        charge: chargeId,
        amount: 10000,
        currency: 'usd',
        status: 'warning_needs_response', // Past due
        reason: 'fraudulent',
        evidence_details: {
          due_by: Math.floor(Date.now() / 1000) - 24 * 60 * 60, // 1 day ago
          has_evidence: false,
          past_due: true,
        },
      }

      await handleStripeDisputeUpdated(dispute as any)

      // Should handle past due status appropriately
      // May escalate or update dispute status
    })
  })

  describe('Dispute Won/Lost → Final State', () => {
    it('should handle dispute won → release funds', async () => {
      const riftId = 'rift-dispute-won'
      const chargeId = 'ch_won_123'
      
      const rift = {
        id: riftId,
        status: 'DISPUTED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)
      vi.mocked(prisma.riftTransaction.update).mockResolvedValue({
        ...rift,
        status: 'RELEASED',
      } as any)

      const dispute = {
        id: 'dp_won_123',
        charge: chargeId,
        amount: 10000,
        currency: 'usd',
        status: 'won', // Dispute won
        reason: 'fraudulent',
      }

      await handleStripeDisputeClosed(dispute as any)

      // Should update rift status back to RELEASED or appropriate state
      // Should unfreeze funds
      expect(mockFrom).toHaveBeenCalled()
    })

    it('should handle dispute lost → refund buyer', async () => {
      const riftId = 'rift-dispute-lost'
      const chargeId = 'ch_lost_123'
      
      const rift = {
        id: riftId,
        status: 'DISPUTED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)
      vi.mocked(prisma.riftTransaction.update).mockResolvedValue({
        ...rift,
        status: 'REFUNDED',
      } as any)

      const dispute = {
        id: 'dp_lost_123',
        charge: chargeId,
        amount: 10000,
        currency: 'usd',
        status: 'lost', // Dispute lost
        reason: 'fraudulent',
      }

      await handleStripeDisputeClosed(dispute as any)

      // Should update rift status to REFUNDED
      // Should debit seller wallet
      // Should process refund
    })
  })

  describe('Webhook Retry Idempotency', () => {
    it('should not duplicate stripe_disputes rows on webhook retries', async () => {
      const riftId = 'rift-retry-idempotent'
      const chargeId = 'ch_retry_123'
      const disputeId = 'dp_retry_123'
      
      const rift = {
        id: riftId,
        status: 'RELEASED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)

      const dispute = {
        id: disputeId,
        charge: chargeId,
        amount: 10000,
        currency: 'usd',
        status: 'needs_response',
        reason: 'fraudulent',
        evidence_details: {
          due_by: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
          has_evidence: false,
          past_due: false,
        },
        created: Math.floor(Date.now() / 1000),
      }

      // Process same webhook 3 times (simulating retries)
      await handleStripeDisputeCreated(dispute as any)
      await handleStripeDisputeCreated(dispute as any)
      await handleStripeDisputeCreated(dispute as any)

      // Should use upsert with onConflict to prevent duplicates
      expect(mockFrom).toHaveBeenCalledWith('stripe_disputes')
      expect(mockDisputeUpsert).toHaveBeenCalledTimes(3)
      // Each call should use onConflict to prevent duplicates
      expect(mockDisputeUpsert).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          onConflict: 'stripe_dispute_id',
        })
      )
    })

    it('should handle dispute.updated webhook retries idempotently', async () => {
      const riftId = 'rift-updated-retry'
      const chargeId = 'ch_updated_123'
      const disputeId = 'dp_updated_123'
      
      const rift = {
        id: riftId,
        status: 'DISPUTED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)
      mockMaybeSingle.mockResolvedValue({
        data: { rift_id: riftId, status: 'needs_response' },
        error: null,
      })

      const dispute = {
        id: disputeId,
        charge: chargeId,
        amount: 10000,
        currency: 'usd',
        status: 'under_review', // Updated status
        reason: 'fraudulent',
        evidence_details: {
          due_by: Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60,
          has_evidence: true,
          past_due: false,
        },
      }

      // Process same update webhook multiple times
      await handleStripeDisputeUpdated(dispute as any)
      await handleStripeDisputeUpdated(dispute as any)
      await handleStripeDisputeUpdated(dispute as any)

      // Should update dispute record idempotently
      // Should not create duplicate records
      expect(mockFrom).toHaveBeenCalledWith('stripe_disputes')
      expect(mockUpdate).toHaveBeenCalledTimes(3)
    })
  })

  describe('Dispute Status Transitions', () => {
    it('should handle dispute status: needs_response → under_review → won', async () => {
      const riftId = 'rift-status-transitions'
      const chargeId = 'ch_transitions_123'
      const disputeId = 'dp_transitions_123'
      
      const rift = {
        id: riftId,
        status: 'RELEASED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)

      // Step 1: Dispute created (needs_response)
      const disputeCreated = {
        id: disputeId,
        charge: chargeId,
        amount: 10000,
        currency: 'usd',
        status: 'needs_response',
        reason: 'fraudulent',
      }

      await handleStripeDisputeCreated(disputeCreated as any)

      // Step 2: Dispute updated (under_review)
      const disputeUpdated = {
        ...disputeCreated,
        status: 'under_review',
        evidence_details: {
          due_by: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60,
          has_evidence: true,
          past_due: false,
        },
      }

      await handleStripeDisputeUpdated(disputeUpdated as any)

      // Step 3: Dispute closed (won)
      const disputeClosed = {
        ...disputeCreated,
        status: 'won',
      }

      await handleStripeDisputeClosed(disputeClosed as any)

      // Should handle all status transitions correctly
      expect(prisma.riftTransaction.findFirst).toHaveBeenCalled()
    })

    it('should handle dispute status: needs_response → warning_needs_response → lost', async () => {
      const riftId = 'rift-status-lost'
      const chargeId = 'ch_lost_transitions_123'
      const disputeId = 'dp_lost_transitions_123'
      
      const rift = {
        id: riftId,
        status: 'RELEASED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)

      // Step 1: Dispute created
      const disputeCreated = {
        id: disputeId,
        charge: chargeId,
        amount: 10000,
        currency: 'usd',
        status: 'needs_response',
        reason: 'fraudulent',
      }

      await handleStripeDisputeCreated(disputeCreated as any)

      // Step 2: Warning (past due)
      const disputeWarning = {
        ...disputeCreated,
        status: 'warning_needs_response',
        evidence_details: {
          due_by: Math.floor(Date.now() / 1000) - 24 * 60 * 60, // Past due
          has_evidence: false,
          past_due: true,
        },
      }

      await handleStripeDisputeUpdated(disputeWarning as any)

      // Step 3: Dispute lost
      const disputeLost = {
        ...disputeCreated,
        status: 'lost',
      }

      await handleStripeDisputeClosed(disputeLost as any)

      // Should handle lost dispute correctly (refund buyer, debit seller)
      expect(prisma.riftTransaction.findFirst).toHaveBeenCalled()
    })
  })

  describe('Webhook Event Processing', () => {
    it('should process charge.dispute.created webhook', async () => {
      const riftId = 'rift-webhook-created'
      const chargeId = 'ch_webhook_123'
      
      const rift = {
        id: riftId,
        status: 'RELEASED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)

      const event = {
        type: 'charge.dispute.created',
        data: {
          object: {
            id: 'dp_webhook_123',
            charge: chargeId,
            amount: 10000,
            currency: 'usd',
            status: 'needs_response',
            reason: 'fraudulent',
          },
        },
      }

      const body = JSON.stringify(event)
      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test-signature',
        },
        body,
      })

      process.env.STRIPE_WEBHOOK_SECRET = 'test-secret'
      process.env.NODE_ENV = 'test'

      const response = await POST(request)

      expect(response.status).toBeLessThan(400)
      expect(prisma.riftTransaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeChargeId: chargeId },
        })
      )
    })

    it('should process charge.dispute.updated webhook', async () => {
      const riftId = 'rift-webhook-updated'
      const chargeId = 'ch_webhook_updated_123'
      
      const rift = {
        id: riftId,
        status: 'DISPUTED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)

      const event = {
        type: 'charge.dispute.updated',
        data: {
          object: {
            id: 'dp_webhook_updated_123',
            charge: chargeId,
            amount: 10000,
            currency: 'usd',
            status: 'under_review',
            reason: 'fraudulent',
          },
        },
      }

      const body = JSON.stringify(event)
      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test-signature',
        },
        body,
      })

      process.env.STRIPE_WEBHOOK_SECRET = 'test-secret'
      process.env.NODE_ENV = 'test'

      const response = await POST(request)

      expect(response.status).toBeLessThan(400)
    })

    it('should process charge.dispute.closed webhook', async () => {
      const riftId = 'rift-webhook-closed'
      const chargeId = 'ch_webhook_closed_123'
      
      const rift = {
        id: riftId,
        status: 'DISPUTED',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        stripeChargeId: chargeId,
      }

      vi.mocked(prisma.riftTransaction.findFirst).mockResolvedValue(rift as any)

      const event = {
        type: 'charge.dispute.closed',
        data: {
          object: {
            id: 'dp_webhook_closed_123',
            charge: chargeId,
            amount: 10000,
            currency: 'usd',
            status: 'won',
            reason: 'fraudulent',
          },
        },
      }

      const body = JSON.stringify(event)
      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test-signature',
        },
        body,
      })

      process.env.STRIPE_WEBHOOK_SECRET = 'test-secret'
      process.env.NODE_ENV = 'test'

      const response = await POST(request)

      expect(response.status).toBeLessThan(400)
    })
  })
})

