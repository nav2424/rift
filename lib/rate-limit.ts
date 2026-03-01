/**
 * Rate limiting with Redis (Upstash) backend
 * Falls back to in-memory when Redis is unavailable
 */

import { Redis } from '@upstash/redis'

let redis: Redis | null = null

try {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    redis = new Redis({ url, token })
  }
} catch {
  // Redis not available, will use in-memory fallback
}

// In-memory fallback store
const memoryStore = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitOptions {
  windowMs: number
  maxRequests: number
  keyGenerator?: (request: Request) => string
  keyPrefix?: string
}

const defaultKeyGenerator = (request: Request): string => {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
  const userId = request.headers.get('x-user-id')
  return userId ? `${userId}:${ip}` : ip
}

async function redisRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  if (!redis) {
    return memoryRateLimit(key, windowMs, maxRequests)
  }

  try {
    const windowSec = Math.ceil(windowMs / 1000)
    const redisKey = `rl:${key}`
    
    const pipe = redis.pipeline()
    pipe.incr(redisKey)
    pipe.pttl(redisKey)
    const results = await pipe.exec<[number, number]>()
    
    const count = results[0] as number
    const ttl = results[1] as number
    
    // Set expiry on first request in window
    if (count === 1 || ttl === -1) {
      await redis.expire(redisKey, windowSec)
    }
    
    const resetTime = Date.now() + (ttl > 0 ? ttl : windowMs)
    const remaining = Math.max(0, maxRequests - count)
    
    return {
      allowed: count <= maxRequests,
      remaining,
      resetTime,
    }
  } catch {
    // Redis error, fall back to memory
    return memoryRateLimit(key, windowMs, maxRequests)
  }
}

function memoryRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()

  // Periodic cleanup
  if (Math.random() < 0.01) {
    for (const [k, v] of memoryStore) {
      if (v.resetTime < now) memoryStore.delete(k)
    }
  }

  let record = memoryStore.get(key)

  if (!record || record.resetTime < now) {
    record = { count: 1, resetTime: now + windowMs }
    memoryStore.set(key, record)
    return { allowed: true, remaining: maxRequests - 1, resetTime: record.resetTime }
  }

  record.count++

  if (record.count > maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime }
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator, keyPrefix = '' } = options

  return async (request: Request): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
    const baseKey = keyGenerator(request)
    const key = keyPrefix ? `${keyPrefix}:${baseKey}` : baseKey
    return redisRateLimit(key, windowMs, maxRequests)
  }
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const limiter = rateLimit(options)

  return async (request: Request): Promise<Response | null> => {
    const result = await limiter(request)

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

    return null
  }
}

// Pre-configured rate limiters
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  keyPrefix: 'api',
})

export const strictApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'strict',
})

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'auth',
})
