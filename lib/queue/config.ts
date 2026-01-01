/**
 * BullMQ Queue Configuration
 * Centralized configuration for all job queues
 * 
 * Uses Upstash Redis for Vercel serverless compatibility
 * BullMQ requires Redis protocol (not REST), so we use ioredis with Upstash endpoint
 */

import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq'
import Redis from 'ioredis'

// Hard fail if Upstash Redis env vars are missing (no localhost fallback)
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error(
      'Upstash Redis environment variables are required in production. ' +
      'Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your Vercel environment variables.'
    )
  }
  // In development, allow localhost fallback only if explicitly set
  if (!process.env.REDIS_HOST) {
    console.warn(
      '⚠️ Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local, ' +
      'or set REDIS_HOST for local development.'
    )
  }
}

// Extract Upstash Redis connection details
// Upstash provides both REST and Redis protocol endpoints
// For BullMQ, we need the Redis protocol endpoint
function getUpstashRedisConfig() {
  // Option 1: Use UPSTASH_REDIS_URL if provided (Redis protocol endpoint)
  if (process.env.UPSTASH_REDIS_URL) {
    try {
      // Parse Redis URL format: redis://default:[password]@[host]:[port]
      const redisUrl = new URL(process.env.UPSTASH_REDIS_URL)
      return {
        host: redisUrl.hostname,
        port: parseInt(redisUrl.port || '6379'),
        password: redisUrl.password || process.env.UPSTASH_REDIS_REST_TOKEN,
        tls: redisUrl.protocol === 'rediss:' ? {
          rejectUnauthorized: true,
        } : undefined,
        maxRetriesPerRequest: null,
      }
    } catch (error) {
      throw new Error(`Invalid UPSTASH_REDIS_URL format: ${process.env.UPSTASH_REDIS_URL}`)
    }
  }
  
  // Option 2: Construct from REST URL (Upstash REST URL format: https://[endpoint].upstash.io)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const url = new URL(process.env.UPSTASH_REDIS_REST_URL)
      // Extract hostname from REST URL (e.g., "usw1-xxx.upstash.io")
      const hostname = url.hostname
      // Upstash Redis protocol endpoint uses port 6379 (or 6380 for TLS)
      // Most Upstash instances use TLS, so try 6380 first
      return {
        host: hostname,
        port: 6380, // TLS port for Upstash
        password: process.env.UPSTASH_REDIS_REST_TOKEN,
        tls: {
          rejectUnauthorized: true,
        },
        maxRetriesPerRequest: null,
      }
    } catch (error) {
      throw new Error(
        `Invalid UPSTASH_REDIS_REST_URL format: ${process.env.UPSTASH_REDIS_REST_URL}. ` +
        'Expected format: https://[endpoint].upstash.io'
      )
    }
  }
  
  // Fallback to localhost only in development
  if (process.env.NODE_ENV === 'development' && process.env.REDIS_HOST) {
    return {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: null,
    }
  }
  
  throw new Error(
    'Redis configuration is missing. Set UPSTASH_REDIS_URL (preferred) or ' +
    'UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for production, ' +
    'or REDIS_HOST for local development.'
  )
}

// Create Redis connection
export const redisConnection = new Redis(getUpstashRedisConfig())

// Queue names
export const QUEUE_NAMES = {
  VERIFICATION: 'rift-verification',
  VIRUS_SCAN: 'rift-virus-scan',
  CLEANUP: 'rift-cleanup',
  EMAIL: 'rift-email',
} as const

// Default queue options
const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
}

// Default worker options
export const defaultWorkerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: 5, // Process 5 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs
    duration: 1000, // Per second
  },
}

/**
 * Create a queue instance
 */
export function createQueue<T = any>(name: string, options?: Partial<QueueOptions>): Queue<T> {
  return new Queue<T>(name, {
    ...defaultQueueOptions,
    ...options,
  })
}

/**
 * Create a worker instance
 */
export function createWorker<T = any>(
  name: string,
  processor: (job: { data: T }) => Promise<void>,
  options?: Partial<WorkerOptions>
): Worker<T> {
  return new Worker<T>(name, processor, {
    ...defaultWorkerOptions,
    ...options,
  })
}

/**
 * Get queue instance (singleton pattern)
 */
const queues: Map<string, Queue> = new Map()

export function getQueue<T = any>(name: string): Queue<T> {
  if (!queues.has(name)) {
    queues.set(name, createQueue<T>(name))
  }
  return queues.get(name) as Queue<T>
}

/**
 * Graceful shutdown
 */
export async function closeQueues(): Promise<void> {
  await Promise.all(Array.from(queues.values()).map((queue) => queue.close()))
  await redisConnection.quit()
}

// Handle Redis connection errors
redisConnection.on('error', (error) => {
  console.error('Redis connection error:', error)
})

redisConnection.on('connect', () => {
  console.log('Redis connected successfully')
})

