/**
 * BullMQ Queue Configuration
 * Centralized configuration for all job queues
 * 
 * Uses Upstash Redis for Vercel serverless compatibility
 * BullMQ requires Redis protocol (not REST), so we use ioredis with Upstash endpoint
 */

import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq'
import Redis from 'ioredis'

// SAFE Redis diagnostic logging (no secrets exposed)
// This runs at module load (server-side only)
if (typeof window === 'undefined') {
  const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || ''
  const restUrl = process.env.UPSTASH_REDIS_REST_URL || ''
  const hasRestToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)
  
  console.log('[redis] Diagnostic:')
  console.log('  - UPSTASH_REDIS_URL present:', Boolean(redisUrl))
  if (redisUrl) {
    const scheme = redisUrl.split(':')[0]
    const hostMatch = redisUrl.replace(/.*@/, '').split(':')[0]
    const host = hostMatch || 'unknown'
    console.log('  - scheme:', scheme, scheme === 'rediss' ? '(TLS)' : '(no TLS)')
    console.log('  - host:', host === 'localhost' ? '⚠️ LOCALHOST (wrong!)' : host)
  }
  console.log('  - UPSTASH_REDIS_REST_URL present:', Boolean(restUrl))
  console.log('  - UPSTASH_REDIS_REST_TOKEN present:', hasRestToken)
  
  if (!redisUrl && !restUrl) {
    console.warn('[redis] ⚠️ No Redis URL configured! Set UPSTASH_REDIS_URL or UPSTASH_REDIS_REST_URL in Vercel')
  }
}

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
  // Option 1: Use UPSTASH_REDIS_URL or REDIS_URL if provided (Redis protocol endpoint)
  const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL
  if (redisUrl) {
    try {
      // Parse Redis URL format: rediss://default:[password]@[host]:[port] or redis://...
      const url = new URL(redisUrl)
      const useTls = url.protocol === 'rediss:'
      
      return {
        host: url.hostname,
        port: parseInt(url.port || (useTls ? '6380' : '6379')),
        password: url.password || url.username || process.env.UPSTASH_REDIS_REST_TOKEN,
        tls: useTls ? {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        } : undefined,
        maxRetriesPerRequest: null,
      }
    } catch (error) {
      throw new Error(`Invalid Redis URL format: ${redisUrl}`)
    }
  }
  
  // Option 2: Construct from REST URL (Upstash REST URL format: https://[endpoint].upstash.io)
  // NOTE: This is a fallback - Upstash provides a Redis protocol URL in their dashboard
  // which is preferred: rediss://default:[token]@[endpoint]:[port]
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const url = new URL(process.env.UPSTASH_REDIS_REST_URL)
      // Extract hostname from REST URL (e.g., "usw1-xxx.upstash.io")
      // Remove .upstash.io and any path to get just the endpoint
      let hostname = url.hostname.replace(/\.upstash\.io$/, '')
      
      // Upstash Redis protocol endpoint format:
      // For TLS: [endpoint].upstash.io on port 6380
      // For non-TLS: [endpoint].upstash.io on port 6379
      // Modern Upstash instances use TLS on port 6380
      hostname = `${hostname}.upstash.io`
      
      return {
        host: hostname,
        port: 6380, // TLS port for Upstash (most common)
        password: process.env.UPSTASH_REDIS_REST_TOKEN,
        tls: {
          rejectUnauthorized: true,
          // Allow legacy TLS versions if needed
          minVersion: 'TLSv1.2',
        },
        maxRetriesPerRequest: null,
        // Additional connection options for better reliability
        keepAlive: 30000,
        connectTimeout: 10000,
        enableReadyCheck: false,
      }
    } catch (error) {
      throw new Error(
        `Invalid UPSTASH_REDIS_REST_URL format: ${process.env.UPSTASH_REDIS_REST_URL}. ` +
        'Expected format: https://[endpoint].upstash.io. ' +
        'For better reliability, use UPSTASH_REDIS_URL with the Redis protocol endpoint from Upstash dashboard.'
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

// Create Redis connection lazily - only when needed
// This prevents blocking on module load if Redis is unavailable
let redisConnectionInstance: Redis | null = null
let redisConnectionFailed = false // Track if connection has permanently failed
let redisNotConfigured = false // Track if Redis env vars are missing

// Check if Redis is configured at module load
function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_URL || 
    process.env.REDIS_URL ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.NODE_ENV === 'development' && process.env.REDIS_HOST))
}

// Create a no-op Redis connection that fails silently
function createNoOpRedisConnection(): Redis {
  const noOp = new Redis({
    host: 'localhost',
    port: 6379,
    connectTimeout: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    enableReadyCheck: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null, // Never retry
    showFriendlyErrorStack: false,
  })
  
  // Suppress all errors from this connection
  const originalEmit = noOp.emit.bind(noOp)
  noOp.emit = function(event: string, ...args: any[]) {
    if (event === 'error') {
      // Silently ignore errors
      return false
    }
    return originalEmit(event, ...args)
  }
  
  // Override error handler to do nothing
  noOp.on('error', () => {})
  
  return noOp
}

function getRedisConnection(): Redis {
  // If Redis is not configured, return no-op connection immediately
  if (!isRedisConfigured()) {
    if (!redisConnectionInstance) {
      redisConnectionInstance = createNoOpRedisConnection()
      redisNotConfigured = true
    }
    return redisConnectionInstance
  }
  
  // If connection already failed, return a no-op connection immediately
  if (redisConnectionFailed && redisConnectionInstance) {
    return redisConnectionInstance
  }
  
  if (!redisConnectionInstance) {
    try {
      const config = getUpstashRedisConfig()
      const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || ''
      
      // Determine if TLS should be used
      const useTls = redisUrl.startsWith('rediss://') || config.tls
      
      redisConnectionInstance = new Redis({
        ...config,
        // Force correct TLS behavior
        tls: useTls ? {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        } : undefined,
        // Timeout settings - prevent hanging forever
        connectTimeout: 6000, // 6 seconds - fail fast
        commandTimeout: 5000, // 5 seconds per command
        lazyConnect: true, // Don't connect immediately - connect on first use
        // Retry strategy - fail fast, avoid infinite retries
        retryStrategy: (times) => {
          if (times > 1) {
            redisConnectionFailed = true
            console.warn('[Redis] Connection failed after retries. Queue operations will fail gracefully.')
            return null // Stop retrying
          }
          return 1000 // Retry once after 1 second
        },
        maxRetriesPerRequest: 1, // Only retry once per request
        enableOfflineQueue: false, // Don't queue commands when offline
        enableReadyCheck: false, // Skip ready check (can cause hangs)
        family: 4, // Force IPv4 (some networks have IPv6 issues)
        showFriendlyErrorStack: false, // Don't show full stack traces
        // Suppress automatic reconnection attempts
        autoResubscribe: false,
        autoResendUnfulfilledCommands: false,
        // reconnectOnError can be boolean or function - use false to disable
        reconnectOnError: (err: Error) => {
          // Don't auto-reconnect on error
          return false
        },
        keepAlive: 10000, // Keep connection alive for 10 seconds
      })
      
      // Set up error handlers
      redisConnectionInstance.on('error', (error) => {
        // Suppress ETIMEDOUT errors - they're expected when Redis is unreachable
        if (error.code === 'ETIMEDOUT' || error.message?.includes('connect ETIMEDOUT')) {
          redisConnectionFailed = true
          // Only log the first timeout to avoid spam
          if (!redisConnectionFailed) {
            console.error('[Redis] Connection timeout - Redis unreachable. Queue operations will fail gracefully.')
          }
          return
        }
        
        // Log other errors (but only once)
        if (!redisConnectionFailed && error.message && !error.message.includes('connect')) {
          console.error('[Redis] Connection error (non-fatal):', error.message)
        }
      })
      
      // Handle connection close/timeout
      redisConnectionInstance.on('close', () => {
        redisConnectionFailed = true
      })
      
      console.log('[Redis] Connection client created (lazy connect enabled)')
      
    } catch (error: any) {
      redisConnectionFailed = true
      // Only log if it's not a configuration error (those are expected)
      if (!error.message?.includes('configuration') && !error.message?.includes('missing')) {
        console.warn('[Redis] Failed to create connection (will fail gracefully):', error.message || error)
      }
      // Create a no-op connection that will fail gracefully
      redisConnectionInstance = createNoOpRedisConnection()
    }
  }
  return redisConnectionInstance
}

// Export the getter function instead of the connection directly
export function getRedisConnectionForQueue(): Redis {
  return getRedisConnection()
}

// For backward compatibility, export redisConnection as a getter
// This proxy should be used carefully - prefer getRedisConnectionForQueue() instead
// to avoid repeated connection attempts
export const redisConnection = new Proxy({} as Redis, {
  get(target, prop) {
    // If connection has failed or Redis is not configured, return no-op methods
    if (redisConnectionFailed || redisNotConfigured) {
      if (prop === 'ping') {
        return async () => {
          // Don't throw - just return a rejected promise that won't be logged
          return Promise.reject(new Error('Redis unavailable'))
        }
      }
      if (prop === 'quit') {
        return async () => Promise.resolve('OK')
      }
      if (prop === 'get' || prop === 'set' || prop === 'del' || prop === 'exists') {
        // Return methods that fail silently
        return async () => {
          throw new Error('Redis unavailable')
        }
      }
      // For other methods, return the connection but it won't actually connect
      const conn = getRedisConnection()
      const method = (conn as any)[prop]
      if (typeof method === 'function') {
        return (...args: any[]) => {
          try {
            return method.apply(conn, args)
          } catch (error) {
            // Suppress errors from no-op connection
            return Promise.reject(error)
          }
        }
      }
      return method
    }
    return (getRedisConnection() as any)[prop]
  }
})

// Queue names
export const QUEUE_NAMES = {
  VERIFICATION: 'rift-verification',
  VIRUS_SCAN: 'rift-virus-scan',
  CLEANUP: 'rift-cleanup',
  EMAIL: 'rift-email',
} as const

// Check if Redis is available (non-blocking)
export async function isRedisAvailable(): Promise<boolean> {
  // If Redis is not configured, return false immediately
  if (!isRedisConfigured() || redisNotConfigured) {
    return false
  }
  
  // If connection has already failed, return false immediately
  if (redisConnectionFailed) {
    return false
  }
  
  try {
    const conn = getRedisConnection()
    // Use a short timeout to avoid hanging
    await Promise.race([
      conn.ping().catch(() => {
        throw new Error('Redis ping failed')
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Redis ping timeout')), 2000)
      )
    ])
    // If ping succeeds, reset the failed flag in case it was set
    redisConnectionFailed = false
    redisNotConfigured = false
    return true
  } catch (error: any) {
    // Mark as failed to avoid repeated checks
    redisConnectionFailed = true
    // Redis is not available - this is OK, we'll continue without it
    // Don't log timeout errors as they're expected if Redis is unavailable
    // Errors are suppressed above, so no need to log here
    return false
  }
}

// Default queue options - use getter to avoid connection on module load
const defaultQueueOptions: QueueOptions = {
  connection: redisConnectionInstance as any, // Will be resolved lazily
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

// Default worker options - use getter to avoid connection on module load
export const defaultWorkerOptions: WorkerOptions = {
  connection: redisConnectionInstance as any, // Will be resolved lazily
  concurrency: 5, // Process 5 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs
    duration: 1000, // Per second
  },
}

/**
 * Create a queue instance
 * Returns null if Redis is not configured or unavailable (instead of throwing)
 */
export function createQueue<T = any>(name: string, options?: Partial<QueueOptions>): Queue<T> | null {
  // If Redis is not configured, don't create the queue to avoid connection attempts
  if (!isRedisConfigured()) {
    return null
  }
  
  try {
    return new Queue<T>(name, {
      ...defaultQueueOptions,
      ...options,
    })
  } catch (error) {
    // If queue creation fails, return null instead of throwing
    console.warn(`[Queue] Failed to create queue "${name}":`, error)
    return null
  }
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
 * Returns null if Redis is not configured or unavailable
 */
const queues: Map<string, Queue> = new Map()

export function getQueue<T = any>(name: string): Queue<T> | null {
  if (!queues.has(name)) {
    const queue = createQueue<T>(name)
    if (!queue) {
      return null // Redis not configured or unavailable
    }
    queues.set(name, queue)
  }
  return queues.get(name) as Queue<T> | null
}

/**
 * Graceful shutdown
 */
export async function closeQueues(): Promise<void> {
  try {
    await Promise.all(Array.from(queues.values()).map((queue) => queue.close()))
    if (redisConnectionInstance) {
      await redisConnectionInstance.quit().catch(() => {
        // Ignore errors during shutdown
      })
    }
  } catch (error) {
    // Ignore errors during shutdown
  }
}

/**
 * Safe Redis operation wrapper
 * Executes Redis operation with fallback if Redis is unavailable
 * This prevents the app from crashing when Redis is unreachable
 */
export async function redisSafe<T>(
  fn: () => Promise<T>,
  fallback: T,
  errorContext?: string
): Promise<T> {
  try {
    return await fn()
  } catch (e: any) {
    // Only log if it's not a timeout (timeouts are expected when Redis is down)
    if (!e.message?.includes('ETIMEDOUT') && !e.message?.includes('unavailable')) {
      console.error(`[redis] Operation failed${errorContext ? ` (${errorContext})` : ''}:`, e.message || e)
    }
    return fallback
  }
}

/**
 * Safe Redis connection check
 * Returns true only if Redis is configured AND reachable
 */
export async function redisSafeCheck(): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false
  }
  
  if (redisConnectionFailed || redisNotConfigured) {
    return false
  }
  
  return await redisSafe(
    async () => {
      const conn = getRedisConnection()
      await Promise.race([
        conn.ping(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Ping timeout')), 2000)
        )
      ])
      return true
    },
    false,
    'connection check'
  )
}

