/**
 * Rate Limits for Proof Submission, Downloads, and Reveals
 * Prevents abuse of sensitive operations
 */

import { rateLimit, RateLimitOptions } from './rate-limit'

/**
 * Rate limit configuration for proof submissions
 * Prevents spam submissions and abuse
 */
export const proofSubmissionRateLimit: (request: Request | any) => {
  allowed: boolean
  remaining: number
  resetTime: number
} = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 proof submissions per hour per user
  keyGenerator: (request: Request | any) => {
    // Extract user ID from request headers or request.userId property
    const userId = request.headers?.get('x-user-id') || 
                   (request as any).userId || 
                   'anonymous'
    const ip = request.headers?.get('x-forwarded-for')?.split(',')[0] || 
               request.headers?.get('x-real-ip') || 
               'unknown'
    return `proof-submission:${userId}:${ip}`
  },
})

/**
 * Rate limit configuration for vault asset downloads
 * Prevents excessive downloads
 */
export const vaultDownloadRateLimit: (request: Request | any) => {
  allowed: boolean
  remaining: number
  resetTime: number
} = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50, // 50 downloads per hour per user
  keyGenerator: (request: Request | any) => {
    const userId = request.headers?.get('x-user-id') || 
                  (request as any).userId || 
                  'anonymous'
    const ip = request.headers?.get('x-forwarded-for')?.split(',')[0] || 
               request.headers?.get('x-real-ip') || 
               'unknown'
    return `vault-download:${userId}:${ip}`
  },
})

/**
 * Rate limit configuration for license key reveals
 * Very strict - prevents key harvesting
 */
export const licenseKeyRevealRateLimit: (request: Request | any) => {
  allowed: boolean
  remaining: number
  resetTime: number
} = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxRequests: 5, // 5 key reveals per day per user
  keyGenerator: (request: Request | any) => {
    const userId = request.headers?.get('x-user-id') || 
                   (request as any).userId || 
                   'anonymous'
    const ip = request.headers?.get('x-forwarded-for')?.split(',')[0] || 
               request.headers?.get('x-real-ip') || 
               'unknown'
    return `license-reveal:${userId}:${ip}`
  },
})

/**
 * Rate limit configuration for vault asset views
 * Less strict than downloads but still prevents abuse
 */
export const vaultViewRateLimit: (request: Request | any) => {
  allowed: boolean
  remaining: number
  resetTime: number
} = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 views per 15 minutes per user
  keyGenerator: (request: Request | any) => {
    const userId = request.headers?.get('x-user-id') || 
                   (request as any).userId || 
                   'anonymous'
    const ip = request.headers?.get('x-forwarded-for')?.split(',')[0] || 
               request.headers?.get('x-real-ip') || 
               'unknown'
    return `vault-view:${userId}:${ip}`
  },
})

/**
 * Check rate limit and return result
 * Extracts user ID from NextRequest if available
 */
export function checkProofRateLimit(
  request: Request | any, // Accept NextRequest or any for flexibility
  operation: 'submission' | 'download' | 'reveal' | 'view'
): { allowed: boolean; remaining: number; resetTime: number; error?: string } {
  // Extract user ID from NextRequest if it's a NextRequest
  const nextRequest = request as any
  if (nextRequest.userId) {
    // Set in headers for rate limiter to use (if headers are mutable)
    try {
      if (!request.headers.get('x-user-id')) {
        // Headers may not be mutable, so we'll pass userId directly to keyGenerator
        // The rate limiter will check both headers and request.userId
      }
    } catch (e) {
      // Headers not mutable, continue
    }
  }
  
  let result
  
  switch (operation) {
    case 'submission':
      result = proofSubmissionRateLimit(request)
      break
    case 'download':
      result = vaultDownloadRateLimit(request)
      break
    case 'reveal':
      result = licenseKeyRevealRateLimit(request)
      break
    case 'view':
      result = vaultViewRateLimit(request)
      break
    default:
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now(),
        error: 'Unknown operation',
      }
  }
  
  if (!result.allowed) {
    const operationName = {
      submission: 'proof submissions',
      download: 'downloads',
      reveal: 'license key reveals',
      view: 'views',
    }[operation]
    
    return {
      ...result,
      error: `Rate limit exceeded for ${operationName}. Please try again later.`,
    }
  }
  
  return result
}
