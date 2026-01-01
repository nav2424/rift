/**
 * Upstash Redis Client
 * REST-based Redis client for Vercel serverless compatibility
 */

import { Redis } from '@upstash/redis'

// Hard fail if env vars are missing (no localhost fallback)
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error(
      'Upstash Redis environment variables are required in production. ' +
      'Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your Vercel environment variables.'
    )
  }
  // In development, log warning but allow graceful degradation
  console.warn(
    '⚠️ Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local'
  )
}

// Create Redis client (will be undefined if env vars missing in dev)
export const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

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

