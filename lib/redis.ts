/**
 * Upstash Redis Client
 * REST-based Redis client for Vercel serverless compatibility
 */

import { Redis } from '@upstash/redis'

// SAFE Redis diagnostic logging (server-side only)
if (typeof window === 'undefined') {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL || ''
  const hasRestToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)
  
  console.log('[redis] REST Client Diagnostic:')
  console.log('  - UPSTASH_REDIS_REST_URL present:', Boolean(restUrl))
  if (restUrl) {
    try {
      const url = new URL(restUrl)
      console.log('  - host:', url.hostname)
      console.log('  - scheme:', url.protocol.replace(':', ''))
    } catch (e) {
      console.log('  - ⚠️ Invalid URL format')
    }
  }
  console.log('  - UPSTASH_REDIS_REST_TOKEN present:', hasRestToken)
  
  if (!restUrl || !hasRestToken) {
    console.warn('[redis] ⚠️ REST client not configured! Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel')
  }
}

// Create Redis client using fromEnv() which handles UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// This is the cleanest approach for Upstash on Vercel
let redis: Redis | null = null

try {
  redis = Redis.fromEnv()
} catch (error: any) {
  // In production, this should be configured, but don't crash if missing
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    console.warn(
      '[redis] Upstash REST client not configured. ' +
      'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel environment variables. ' +
      'App will continue without Redis caching.'
    )
  } else {
    // In development, log warning but allow graceful degradation
    console.warn(
      '⚠️ Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local'
    )
  }
}

// Helper to check if Redis is available
export function isRedisAvailable(): boolean {
  return redis !== null
}

// Helper to get Redis client or throw error
export function getRedis(): Redis {
  if (!redis) {
    throw new Error(
      'Redis is not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
    )
  }
  return redis
}

/**
 * Safe Redis operation wrapper for REST client
 * Executes Redis operation with fallback if Redis is unavailable
 * This prevents the app from crashing when Redis is unreachable
 */
export async function redisSafe<T>(
  fn: (client: Redis) => Promise<T>,
  fallback: T,
  errorContext?: string
): Promise<T> {
  if (!redis) {
    return fallback
  }
  
  try {
    return await fn(redis)
  } catch (e: any) {
    // Only log if it's not a timeout (timeouts are expected when Redis is down)
    if (!e.message?.includes('timeout') && !e.message?.includes('ETIMEDOUT')) {
      console.error(`[redis] Operation failed${errorContext ? ` (${errorContext})` : ''}:`, e.message || e)
    }
    return fallback
  }
}

// Export redis client
export { redis }

