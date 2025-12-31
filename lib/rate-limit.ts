/**
 * Simple in-memory rate limiting middleware
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyGenerator?: (request: Request) => string // Custom key generator
}

const defaultKeyGenerator = (request: Request): string => {
  // Get IP address from headers (works with proxies)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
  
  // Also include user ID if available in headers (for authenticated requests)
  const userId = request.headers.get('x-user-id')
  return userId ? `${userId}:${ip}` : ip
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator } = options

  return (request: Request): { allowed: boolean; remaining: number; resetTime: number } => {
    const key = keyGenerator(request)
    const now = Date.now()

    // Clean up old entries periodically (every 1000 requests roughly)
    if (Math.random() < 0.001) {
      Object.keys(store).forEach((k) => {
        if (store[k].resetTime < now) {
          delete store[k]
        }
      })
    }

    let record = store[key]

    // If no record or window expired, create new record
    if (!record || record.resetTime < now) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      }
      store[key] = record
      return { allowed: true, remaining: maxRequests - 1, resetTime: record.resetTime }
    }

    // Increment count
    record.count++

    // Check if limit exceeded
    if (record.count > maxRequests) {
      return { allowed: false, remaining: 0, resetTime: record.resetTime }
    }

    return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime }
  }
}

/**
 * Rate limit middleware for Next.js API routes
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  const limiter = rateLimit(options)

  return async (request: Request): Promise<Response | null> => {
    const result = limiter(request)

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': options.maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // Add rate limit headers to successful requests
    return null // Continue to next middleware/handler
  }
}

// Pre-configured rate limiters
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
})

export const strictApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30, // 30 requests per 15 minutes (for sensitive endpoints)
})

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
})
