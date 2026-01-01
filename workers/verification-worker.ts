/**
 * Verification Worker
 * Processes verification jobs from the queue
 * 
 * Run this as a separate process:
 * npx tsx workers/verification-worker.ts
 */

// Load environment variables from .env file
import { config } from 'dotenv'
config()

import { createWorker, QUEUE_NAMES, defaultWorkerOptions } from '../lib/queue/config'
import { VerificationJobData } from '../lib/queue/jobs'
import { processVerificationJob } from '../lib/queue/verification-queue'

console.log('Starting Verification Worker...')

const worker = createWorker<VerificationJobData>(
  QUEUE_NAMES.VERIFICATION,
  async (job) => {
    console.log(`Processing verification job for rift ${job.data.riftId}`)
    
    // Process the verification
    await processVerificationJob(job.data)
  },
  {
    ...defaultWorkerOptions,
    concurrency: 3, // Process 3 verification jobs concurrently
  }
)

// Worker event handlers
worker.on('completed', (job: any) => {
  console.log(`Verification job completed for rift ${job?.data?.riftId}`)
})

worker.on('failed', (job: any, err) => {
  console.error(`Verification job failed for rift ${job?.data?.riftId}:`, err)
})

worker.on('error', (err) => {
  console.error('Worker error:', err)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...')
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...')
  await worker.close()
  process.exit(0)
})

console.log('Verification Worker started and waiting for jobs...')

