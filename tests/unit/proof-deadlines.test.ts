/**
 * Unit Tests: Proof Deadline Enforcement
 * Tests lib/proof-deadlines.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  calculateProofDeadline,
  isProofDeadlinePassed,
  getHoursUntilProofDeadline,
  calculateAutoReleaseDeadlineFromAccess,
  PROOF_DEADLINE_CONFIGS,
} from '@/lib/proof-deadlines'
import { ItemType } from '@prisma/client'

describe('Proof Deadline Enforcement', () => {
  beforeEach(() => {
    // Mock current time to a fixed date for consistent tests
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('calculateProofDeadline', () => {
    it('should calculate 48h deadline for TICKETS from PAID', () => {
      const paidAt = new Date('2025-01-15T10:00:00Z')
      const deadline = calculateProofDeadline('OWNERSHIP_TRANSFER' as ItemType, paidAt)
      
      const expected = new Date('2025-01-17T10:00:00Z') // 48 hours later
      expect(deadline.getTime()).toBe(expected.getTime())
    })

    it('should calculate 24h deadline for DIGITAL from PAID', () => {
      const paidAt = new Date('2025-01-15T10:00:00Z')
      const deadline = calculateProofDeadline('DIGITAL_GOODS' as ItemType, paidAt)
      
      const expected = new Date('2025-01-16T10:00:00Z') // 24 hours later
      expect(deadline.getTime()).toBe(expected.getTime())
    })

    it('should calculate 24h deadline for LICENSE_KEYS from PAID', () => {
      const paidAt = new Date('2025-01-15T10:00:00Z')
      const deadline = calculateProofDeadline('LICENSE_KEYS' as ItemType, paidAt)
      
      const expected = new Date('2025-01-16T10:00:00Z') // 24 hours later
      expect(deadline.getTime()).toBe(expected.getTime())
    })

    it('should calculate deadline for SERVICES from agreed delivery date', () => {
      const paidAt = new Date('2025-01-15T10:00:00Z')
      const agreedDeliveryDate = new Date('2025-01-20T10:00:00Z')
      const deadline = calculateProofDeadline('SERVICES' as ItemType, paidAt, agreedDeliveryDate)
      
      // Deadline is agreed date + 24h grace window
      const expected = new Date('2025-01-21T10:00:00Z')
      expect(deadline.getTime()).toBe(expected.getTime())
    })

    it('should use standard deadline for SERVICES if no agreed date', () => {
      const paidAt = new Date('2025-01-15T10:00:00Z')
      const deadline = calculateProofDeadline('SERVICES' as ItemType, paidAt)
      
      const expected = new Date('2025-01-16T10:00:00Z') // 24 hours later
      expect(deadline.getTime()).toBe(expected.getTime())
    })
  })

  describe('isProofDeadlinePassed', () => {
    it('should return true if deadline has passed', () => {
      const paidAt = new Date('2025-01-13T10:00:00Z') // 2 days ago
      const passed = isProofDeadlinePassed('DIGITAL_GOODS' as ItemType, paidAt, null)
      
      expect(passed).toBe(true)
    })

    it('should return false if deadline has not passed', () => {
      const paidAt = new Date('2025-01-15T11:00:00Z') // 1 hour ago
      const passed = isProofDeadlinePassed('DIGITAL_GOODS' as ItemType, paidAt, null)
      
      expect(passed).toBe(false)
    })

    it('should return false if proof already submitted', () => {
      const paidAt = new Date('2025-01-13T10:00:00Z') // 2 days ago (past deadline)
      const proofSubmittedAt = new Date('2025-01-14T10:00:00Z') // 1 day ago
      const passed = isProofDeadlinePassed('DIGITAL_GOODS' as ItemType, paidAt, proofSubmittedAt)
      
      expect(passed).toBe(false) // Not passed because already submitted
    })

    it('should return true for TICKETS after 48h', () => {
      const paidAt = new Date('2025-01-13T10:00:00Z') // 2 days ago
      const passed = isProofDeadlinePassed('OWNERSHIP_TRANSFER' as ItemType, paidAt, null)
      
      expect(passed).toBe(true)
    })

    it('should return false for TICKETS before 48h', () => {
      const paidAt = new Date('2025-01-15T11:00:00Z') // 1 hour ago
      const passed = isProofDeadlinePassed('OWNERSHIP_TRANSFER' as ItemType, paidAt, null)
      
      expect(passed).toBe(false)
    })
  })

  describe('getHoursUntilProofDeadline', () => {
    it('should return positive hours if deadline in future', () => {
      const paidAt = new Date('2025-01-15T11:00:00Z') // 1 hour ago
      const hours = getHoursUntilProofDeadline('DIGITAL_GOODS' as ItemType, paidAt)
      
      expect(hours).toBeGreaterThan(0)
      expect(hours).toBeLessThan(24)
    })

    it('should return negative hours if deadline passed', () => {
      const paidAt = new Date('2025-01-13T10:00:00Z') // 2 days ago
      const hours = getHoursUntilProofDeadline('DIGITAL_GOODS' as ItemType, paidAt)
      
      expect(hours).toBeLessThan(0)
    })

    it('should return correct hours for TICKETS (48h deadline)', () => {
      const paidAt = new Date('2025-01-15T11:00:00Z') // 1 hour ago
      const hours = getHoursUntilProofDeadline('OWNERSHIP_TRANSFER' as ItemType, paidAt)
      
      expect(hours).toBeCloseTo(47, 0) // ~47 hours remaining
    })
  })

  describe('calculateAutoReleaseDeadlineFromAccess', () => {
    it('should calculate 24h after first access for DIGITAL', () => {
      const proofSubmittedAt = new Date('2025-01-15T10:00:00Z')
      const firstBuyerAccessAt = new Date('2025-01-15T11:00:00Z')
      
      const deadline = calculateAutoReleaseDeadlineFromAccess(
        'DIGITAL_GOODS' as ItemType,
        proofSubmittedAt,
        firstBuyerAccessAt
      )
      
      const expected = new Date('2025-01-16T11:00:00Z') // 24h after access
      expect(deadline?.getTime()).toBe(expected.getTime())
    })

    it('should calculate 24h after first access for TICKETS', () => {
      const proofSubmittedAt = new Date('2025-01-15T10:00:00Z')
      const firstBuyerAccessAt = new Date('2025-01-15T11:00:00Z')
      
      const deadline = calculateAutoReleaseDeadlineFromAccess(
        'OWNERSHIP_TRANSFER' as ItemType,
        proofSubmittedAt,
        firstBuyerAccessAt
      )
      
      const expected = new Date('2025-01-16T11:00:00Z') // 24h after access
      expect(deadline?.getTime()).toBe(expected.getTime())
    })

    it('should fallback to submission time if no access for DIGITAL', () => {
      const proofSubmittedAt = new Date('2025-01-15T10:00:00Z')
      
      const deadline = calculateAutoReleaseDeadlineFromAccess(
        'DIGITAL_GOODS' as ItemType,
        proofSubmittedAt,
        null
      )
      
      const expected = new Date('2025-01-17T10:00:00Z') // 48h after submission
      expect(deadline?.getTime()).toBe(expected.getTime())
    })

    it('should use submission time for SERVICES (no access-based release)', () => {
      const proofSubmittedAt = new Date('2025-01-15T10:00:00Z')
      const firstBuyerAccessAt = new Date('2025-01-15T11:00:00Z')
      
      const deadline = calculateAutoReleaseDeadlineFromAccess(
        'SERVICES' as ItemType,
        proofSubmittedAt,
        firstBuyerAccessAt
      )
      
      // SERVICES doesn't have access-based auto-release
      const expected = new Date('2025-01-18T10:00:00Z') // 72h after submission
      expect(deadline?.getTime()).toBe(expected.getTime())
    })

    it('should default to 48h for unsupported types', () => {
      const proofSubmittedAt = new Date('2025-01-15T10:00:00Z')
      
      const deadline = calculateAutoReleaseDeadlineFromAccess(
        'PHYSICAL' as ItemType,
        proofSubmittedAt,
        null
      )
      
      const expected = new Date('2025-01-17T10:00:00Z') // 48h default
      expect(deadline?.getTime()).toBe(expected.getTime())
    })
  })

  describe('PROOF_DEADLINE_CONFIGS', () => {
    it('should have correct config for TICKETS', () => {
      const config = PROOF_DEADLINE_CONFIGS['OWNERSHIP_TRANSFER']
      expect(config).toBeDefined()
      expect(config?.deadlineHours).toBe(48)
      expect(config?.autoReleaseAfterAccessHours).toBe(24)
      expect(config?.autoReleaseAfterSubmissionHours).toBe(48)
    })

    it('should have correct config for DIGITAL', () => {
      const config = PROOF_DEADLINE_CONFIGS['DIGITAL_GOODS']
      expect(config).toBeDefined()
      expect(config?.deadlineHours).toBe(24)
      expect(config?.autoReleaseAfterAccessHours).toBe(24)
      expect(config?.autoReleaseAfterSubmissionHours).toBe(48)
    })

    it('should have correct config for SERVICES', () => {
      const config = PROOF_DEADLINE_CONFIGS['SERVICES']
      expect(config).toBeDefined()
      expect(config?.deadlineHours).toBe(24)
      expect(config?.autoReleaseAfterAccessHours).toBeUndefined()
      expect(config?.autoReleaseAfterSubmissionHours).toBe(72)
    })

    it('should have correct config for LICENSE_KEYS', () => {
      const config = PROOF_DEADLINE_CONFIGS['LICENSE_KEYS']
      expect(config).toBeDefined()
      expect(config?.deadlineHours).toBe(24)
      expect(config?.autoReleaseAfterAccessHours).toBe(24)
      expect(config?.autoReleaseAfterSubmissionHours).toBe(48)
    })
  })
})

