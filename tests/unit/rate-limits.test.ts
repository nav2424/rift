/**
 * Unit Tests: Rate Limits
 * Tests lib/rate-limits-proof.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkProofRateLimit } from '@/lib/rate-limits-proof'

describe('Rate Limits', () => {
  beforeEach(() => {
    // Clear rate limit store between tests
    vi.clearAllMocks()
  })

  describe('checkProofRateLimit', () => {
    it('should allow proof submission within limit', () => {
      const mockRequest = {
        headers: new Headers({
          'x-user-id': 'user1',
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      // First 10 requests should be allowed
      for (let i = 0; i < 10; i++) {
        const result = checkProofRateLimit(mockRequest, 'submission')
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBeGreaterThanOrEqual(0)
      }
    })

    it('should block proof submission after limit exceeded', () => {
      // Use unique key to avoid interference from other tests
      const uniqueUserId = `rate-limit-test-${Date.now()}`
      const mockRequest = {
        headers: new Headers({
          'x-user-id': uniqueUserId,
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      // First 10 should be allowed
      for (let i = 0; i < 10; i++) {
        const result = checkProofRateLimit(mockRequest, 'submission')
        expect(result.allowed).toBe(true)
      }

      // 11th should be blocked
      const result = checkProofRateLimit(mockRequest, 'submission')
      expect(result.allowed).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should enforce different limits for different operations', () => {
      const mockRequest = {
        headers: new Headers({
          'x-user-id': 'user1',
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      // Downloads have higher limit (50/hour)
      for (let i = 0; i < 50; i++) {
        const result = checkProofRateLimit(mockRequest, 'download')
        expect(result.allowed).toBe(true)
      }

      // 51st should be blocked
      const result = checkProofRateLimit(mockRequest, 'download')
      expect(result.allowed).toBe(false)
    })

    it('should enforce strict limit for license key reveals', () => {
      const mockRequest = {
        headers: new Headers({
          'x-user-id': 'user1',
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      // License reveals have very strict limit (5/day)
      for (let i = 0; i < 5; i++) {
        const result = checkProofRateLimit(mockRequest, 'reveal')
        expect(result.allowed).toBe(true)
      }

      // 6th should be blocked
      const result = checkProofRateLimit(mockRequest, 'reveal')
      expect(result.allowed).toBe(false)
    })

    it('should track rate limits per user', () => {
      const user1Request = {
        headers: new Headers({
          'x-user-id': 'user1',
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      const user2Request = {
        headers: new Headers({
          'x-user-id': 'user2',
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      // User 1 exhausts limit
      for (let i = 0; i < 10; i++) {
        checkProofRateLimit(user1Request, 'submission')
      }

      // User 1 should be blocked
      const user1Result = checkProofRateLimit(user1Request, 'submission')
      expect(user1Result.allowed).toBe(false)

      // User 2 should still be allowed
      const user2Result = checkProofRateLimit(user2Request, 'submission')
      expect(user2Result.allowed).toBe(true)
    })

    it('should include reset time in response', () => {
      const mockRequest = {
        headers: new Headers({
          'x-user-id': 'user1',
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      const result = checkProofRateLimit(mockRequest, 'submission')

      expect(result.resetTime).toBeGreaterThan(Date.now())
    })

    it('should return error message when rate limited', () => {
      const mockRequest = {
        headers: new Headers({
          'x-user-id': 'user1',
          'x-forwarded-for': '192.168.1.1',
        }),
      } as any

      // Exceed limit
      for (let i = 0; i < 11; i++) {
        checkProofRateLimit(mockRequest, 'submission')
      }

      const result = checkProofRateLimit(mockRequest, 'submission')
      expect(result.error).toContain('Rate limit exceeded')
      expect(result.error).toContain('proof submissions')
    })
  })
})

