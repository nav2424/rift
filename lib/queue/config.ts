/**
 * BullMQ Queue Configuration
 * Centralized configuration for all job queues
 */

import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq'
import Redis from 'ioredis'

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: null, // Required for BullMQ
}

// Create Redis connection
export const redisConnection = new Redis(redisConfig, {
  maxRetriesPerRequest: null,
})

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

