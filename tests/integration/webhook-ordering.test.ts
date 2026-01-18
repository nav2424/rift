/**
 * Webhook Ordering Tests
 * Ensures webhook processing handles:
 * - payment_intent.succeeded arrives before/after DB row exists
 * - Retry storms (same webhook delivered multiple times)
 * - Out-of-order events
 * - Idempotent webhook processing
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transitionRiftState } from '@/lib/rift-state'

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
    riftEvent: {
      create: vi.fn(),
    },
    stripe_webhook_events: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      riftTransaction: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    })),
  },
}))

vi.mock('@/lib/rift-state', () => ({
  transitionRiftState: vi.fn(),
}))

vi.mock('@/lib/rift-events', () => ({
  logEvent: vi.fn(),
  extractRequestMetadata: vi.fn(() => ({})),
}))

vi.mock('@/lib/email', () => ({
  sendPaymentReceivedEmail: vi.fn(),
}))

vi.mock('@/lib/policy-acceptance', () => ({
  capturePolicyAcceptance: vi.fn(),
}))

vi.mock('@/lib/risk/computeRisk', () => ({
  applyRiskPolicy: vi.fn().mockResolvedValue({ action: 'allow', riskScore: 0 }),
  computeRiftRisk: vi.fn().mockResolvedValue({ riskScore: 0 }),
}))

// Mock Stripe - must be set up before route import
vi.mock('@/lib/stripe', () => {
  const mockConstructEvent = vi.fn((body, signature, secret) => {
    if (typeof body === 'string') {
      const parsed = JSON.parse(body)
      return { livemode: false, ...parsed }
    }
    return { livemode: false, ...body }
  })
  
  return {
    stripe: {
      webhooks: {
        constructEvent: mockConstructEvent,
      },
    },
  }
})

// Dynamic import of webhook handler
let POST: typeof import('@/app/api/webhooks/stripe/route').POST

beforeAll(async () => {
  const routeModule = await import('@/app/api/webhooks/stripe/route')
  POST = routeModule.POST
})

describe('Webhook Ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('payment_intent.succeeded Event Handling', () => {
    it('should handle payment_intent.succeeded when DB row already exists', async () => {
      const riftId = 'rift-existing'
      const paymentIntentId = 'pi_existing_123'
      
      const rift = {
        id: riftId,
        status: 'DRAFT', // Webhook only transitions from DRAFT
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        stripeChargeId: null,
        stripePaymentIntentId: null,
      }

      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)
      vi.mocked(prisma.riftTransaction.update).mockResolvedValue({
        ...rift,
        status: 'FUNDED',
        stripePaymentIntentId: paymentIntentId,
      } as any)
      vi.mocked(prisma.timelineEvent.create).mockResolvedValue({ id: 'timeline-1' } as any)
      vi.mocked(transitionRiftState).mockResolvedValue()

      const { logEvent } = await import('@/lib/rift-events')
      vi.mocked(logEvent).mockResolvedValue()

      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            amount: 10000, // in cents
            currency: 'usd',
            status: 'succeeded',
            metadata: {
              escrowId: riftId, // Uses escrowId, not riftId
            },
            charges: {
              data: [{
                id: 'ch_123',
              }],
            },
            customer: 'cus_123',
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
      expect(prisma.riftTransaction.findUnique).toHaveBeenCalledWith({
        where: { id: riftId },
        select: expect.any(Object),
      })
      expect(transitionRiftState).toHaveBeenCalledWith(riftId, 'FUNDED')
    })

    it('should handle payment_intent.succeeded when DB row does not exist yet', async () => {
      const riftId = 'rift-not-found'
      const paymentIntentId = 'pi_not_found_123'

      // Rift doesn't exist yet (race condition)
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(null)

      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            metadata: {
              escrowId: riftId,
            },
            charges: {
              data: [{
                id: 'ch_123',
              }],
            },
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
      
      // Should handle gracefully - log warning but don't crash
      expect(response.status).toBeLessThan(500)
      // Should not try to update non-existent rift
      expect(prisma.riftTransaction.update).not.toHaveBeenCalled()
      expect(transitionRiftState).not.toHaveBeenCalled()
    })

    it('should handle payment_intent.succeeded when rift is already FUNDED (idempotency)', async () => {
      const riftId = 'rift-already-funded'
      const paymentIntentId = 'pi_already_funded_123'
      
      const rift = {
        id: riftId,
        status: 'FUNDED', // Already funded
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        stripeChargeId: 'ch_existing',
        stripePaymentIntentId: paymentIntentId,
      }

      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)

      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            metadata: {
              escrowId: riftId,
            },
            charges: {
              data: [{
                id: 'ch_existing',
              }],
            },
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
      
      // Should handle idempotently - don't error, but don't process again
      expect(response.status).toBeLessThan(400)
      // Should not transition state again if already FUNDED (only transitions from DRAFT)
      expect(transitionRiftState).not.toHaveBeenCalled()
    })
  })

  describe('Retry Storms', () => {
    it('should handle same webhook delivered multiple times (idempotent)', async () => {
      const riftId = 'rift-retry'
      const paymentIntentId = 'pi_retry_123'
      
      const rift = {
        id: riftId,
        status: 'DRAFT', // Webhook only transitions from DRAFT
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        stripeChargeId: null,
        stripePaymentIntentId: null,
      }

      // First call: rift is DRAFT
      // Subsequent calls: rift is already FUNDED
      vi.mocked(prisma.riftTransaction.findUnique)
        .mockResolvedValueOnce(rift as any) // First webhook delivery
        .mockResolvedValueOnce({
          ...rift,
          status: 'FUNDED',
          stripePaymentIntentId: paymentIntentId,
        } as any) // Second webhook delivery (retry)
        .mockResolvedValueOnce({
          ...rift,
          status: 'FUNDED',
          stripePaymentIntentId: paymentIntentId,
        } as any) // Third webhook delivery (retry)

      vi.mocked(prisma.riftTransaction.update).mockResolvedValue({
        ...rift,
        status: 'FUNDED',
      } as any)
      vi.mocked(prisma.timelineEvent.create).mockResolvedValue({ id: 'timeline-1' } as any)
      vi.mocked(transitionRiftState).mockResolvedValue()

      const { logEvent } = await import('@/lib/rift-events')
      vi.mocked(logEvent).mockResolvedValue()

      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            amount: 10000,
            currency: 'usd',
            status: 'succeeded',
            metadata: {
              escrowId: riftId,
            },
            charges: {
              data: [{
                id: 'ch_123',
              }],
            },
          },
        },
      }

      process.env.STRIPE_WEBHOOK_SECRET = 'test-secret'
      process.env.NODE_ENV = 'test'

      // Process same webhook 3 times (simulating retries)
      // Need to create new request each time since body can only be read once
      const responses = await Promise.all([
        POST(new NextRequest('http://localhost:3000/api/webhooks/stripe', {
          method: 'POST',
          headers: { 'stripe-signature': 'test-signature' },
          body: JSON.stringify(event),
        })),
        POST(new NextRequest('http://localhost:3000/api/webhooks/stripe', {
          method: 'POST',
          headers: { 'stripe-signature': 'test-signature' },
          body: JSON.stringify(event),
        })),
        POST(new NextRequest('http://localhost:3000/api/webhooks/stripe', {
          method: 'POST',
          headers: { 'stripe-signature': 'test-signature' },
          body: JSON.stringify(event),
        })),
      ])
      
      // All should succeed (idempotent)
      responses.forEach(response => {
        expect(response.status).toBeLessThan(400)
      })

      // Should only transition state once (first time when status is DRAFT)
      // Subsequent calls should be no-ops (status is already FUNDED)
      expect(transitionRiftState).toHaveBeenCalledTimes(1)
    })

    it('should handle rapid retry storms without race conditions', async () => {
      const riftId = 'rift-rapid-retry'
      const paymentIntentId = 'pi_rapid_123'
      
      const rift = {
        id: riftId,
        status: 'DRAFT', // Webhook only transitions from DRAFT
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
      }

      // First call sees DRAFT, subsequent calls see FUNDED (simulating rapid retries)
      let callCount = 0
      vi.mocked(prisma.riftTransaction.findUnique).mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return rift as any
        } else {
          // Subsequent calls see FUNDED status
          return {
            ...rift,
            status: 'FUNDED',
            stripePaymentIntentId: paymentIntentId,
          } as any
        }
      })
      
      vi.mocked(prisma.riftTransaction.update).mockResolvedValue({
        ...rift,
        status: 'FUNDED',
        stripePaymentIntentId: paymentIntentId,
      } as any)
      vi.mocked(prisma.timelineEvent.create).mockResolvedValue({ id: 'timeline-1' } as any)
      vi.mocked(transitionRiftState).mockResolvedValue()

      const { logEvent } = await import('@/lib/rift-events')
      vi.mocked(logEvent).mockResolvedValue()

      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            amount: 10000,
            currency: 'usd',
            status: 'succeeded',
            metadata: {
              escrowId: riftId,
            },
            charges: {
              data: [{
                id: 'ch_123',
              }],
            },
          },
        },
      }

      process.env.STRIPE_WEBHOOK_SECRET = 'test-secret'
      process.env.NODE_ENV = 'test'

      // Process 10 rapid retries - create new request each time
      const responses = await Promise.all(
        Array(10).fill(null).map(() => 
          POST(new NextRequest('http://localhost:3000/api/webhooks/stripe', {
            method: 'POST',
            headers: { 'stripe-signature': 'test-signature' },
            body: JSON.stringify(event),
          }))
        )
      )
      
      // All should return success (even if some are no-ops)
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500) // Don't crash on retries
      })

      // Should only transition once (first call when status is DRAFT)
      expect(transitionRiftState).toHaveBeenCalledTimes(1)
    })
  })

  describe('Out-of-Order Events', () => {
    it('should handle payment_intent.succeeded before payment_intent.created', async () => {
      // This can happen if webhook delivery is delayed
      const riftId = 'rift-out-of-order'
      const paymentIntentId = 'pi_out_of_order_123'
      
      const rift = {
        id: riftId,
        status: 'DRAFT', // Webhook only transitions from DRAFT
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
        stripeChargeId: null,
        stripePaymentIntentId: null, // Payment intent not yet stored
      }

      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)
      vi.mocked(prisma.riftTransaction.update).mockResolvedValue({
        ...rift,
        status: 'FUNDED',
        stripePaymentIntentId: paymentIntentId,
      } as any)
      vi.mocked(prisma.timelineEvent.create).mockResolvedValue({ id: 'timeline-1' } as any)
      vi.mocked(transitionRiftState).mockResolvedValue()

      const { logEvent } = await import('@/lib/rift-events')
      vi.mocked(logEvent).mockResolvedValue()

      // payment_intent.succeeded arrives first (out of order)
      const succeededEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            amount: 10000,
            currency: 'usd',
            status: 'succeeded',
            metadata: {
              escrowId: riftId,
            },
            charges: {
              data: [{
                id: 'ch_123',
              }],
            },
          },
        },
      }

      const body = JSON.stringify(succeededEvent)
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
      
      // Should handle gracefully - payment succeeded is the important event
      expect(response.status).toBeLessThan(400)
      expect(transitionRiftState).toHaveBeenCalledWith(riftId, 'FUNDED')
    })

    it('should handle duplicate payment_intent.succeeded events with different timestamps', async () => {
      const riftId = 'rift-duplicate-timestamps'
      const paymentIntentId = 'pi_duplicate_123'
      
      const rift = {
        id: riftId,
        status: 'DRAFT', // Webhook only transitions from DRAFT
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
      }

      vi.mocked(prisma.riftTransaction.findUnique)
        .mockResolvedValueOnce(rift as any) // First event
        .mockResolvedValueOnce({
          ...rift,
          status: 'FUNDED',
        } as any) // Second event (rift already processed)

      vi.mocked(prisma.riftTransaction.update).mockResolvedValue({
        ...rift,
        status: 'FUNDED',
      } as any)
      vi.mocked(prisma.timelineEvent.create).mockResolvedValue({ id: 'timeline-1' } as any)
      vi.mocked(transitionRiftState).mockResolvedValue()

      const { logEvent } = await import('@/lib/rift-events')
      vi.mocked(logEvent).mockResolvedValue()

      const event1 = {
        type: 'payment_intent.succeeded',
        id: 'evt_1',
        created: 1000,
        data: {
          object: {
            id: paymentIntentId,
            amount: 10000,
            currency: 'usd',
            status: 'succeeded',
            metadata: {
              escrowId: riftId,
            },
            charges: {
              data: [{
                id: 'ch_123',
              }],
            },
          },
        },
      }

      const event2 = {
        ...event1,
        id: 'evt_2',
        created: 1001, // Different timestamp
      }

      process.env.STRIPE_WEBHOOK_SECRET = 'test-secret'
      process.env.NODE_ENV = 'test'

      const request1 = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test-signature',
        },
        body: JSON.stringify(event1),
      })

      const request2 = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test-signature',
        },
        body: JSON.stringify(event2),
      })
      
      const [response1, response2] = await Promise.all([
        POST(request1),
        POST(request2),
      ])
      
      // Both should succeed (idempotent)
      expect(response1.status).toBeLessThan(400)
      expect(response2.status).toBeLessThan(400)

      // Should only process once (first call when status is DRAFT)
      expect(transitionRiftState).toHaveBeenCalledTimes(1)
    })
  })

  describe('Webhook Signature Verification', () => {
    it('should reject webhooks with invalid signature', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_invalid',
            metadata: {
              escrowId: 'rift-invalid',
            },
          },
        },
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'invalid-signature',
        },
        body: JSON.stringify(event),
      })

      process.env.STRIPE_WEBHOOK_SECRET = 'test-secret'

      // Mock signature verification to fail
      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.webhooks.constructEvent).mockImplementationOnce(() => {
        throw new Error('Invalid signature')
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Webhook Error')
    })

    it('should accept webhooks with valid signature', async () => {
      const riftId = 'rift-valid-sig'
      const paymentIntentId = 'pi_valid_123'
      
      const rift = {
        id: riftId,
        status: 'AWAITING_PAYMENT',
        subtotal: 100,
        currency: 'usd',
        buyerId: 'buyer-123',
      }

      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValue(rift as any)
      vi.mocked(prisma.riftTransaction.update).mockResolvedValue({
        ...rift,
        status: 'FUNDED',
      } as any)
      vi.mocked(transitionRiftState).mockResolvedValue()

      const event = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            metadata: {
              escrowId: riftId,
            },
            charges: {
              data: [{
                id: 'ch_123',
              }],
            },
          },
        },
      }

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'valid-signature',
        },
        body: JSON.stringify(event),
      })

      process.env.STRIPE_WEBHOOK_SECRET = 'test-secret'

      // Mock signature verification to succeed
      const { stripe } = await import('@/lib/stripe')
      vi.mocked(stripe.webhooks.constructEvent).mockImplementationOnce((body) => {
        return { livemode: false, ...JSON.parse(body as string) }
      })
      
      const response = await POST(request)
      
      expect(response.status).toBeLessThan(400)
    })
  })
})

