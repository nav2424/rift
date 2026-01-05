/**
 * Test Redis and Queue Connection
 * Quick script to verify BullMQ and Redis are working
 */

import { redisConnection, getQueue, QUEUE_NAMES } from '../lib/queue/config'
import { VerificationJobData } from '../lib/queue/jobs'

async function testConnection() {
  try {
    console.log('Testing Redis connection...')
    
    // Test Redis connection
    const pong = await redisConnection.ping()
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed')
    }
    console.log('✅ Redis connection successful!')
    
    // Test queue creation
    console.log('\nTesting queue creation...')
    const queue = getQueue<VerificationJobData>(QUEUE_NAMES.VERIFICATION)
    if (!queue) {
      throw new Error('Queue creation returned null - Redis may not be configured')
    }
    console.log('✅ Queue created successfully!')
    
    // Test adding a job (will fail if Redis not working)
    console.log('\nTesting job queue...')
    const testJob = await queue.add(
      'test-job',
      {
        riftId: 'test-rift-id',
        assetIds: ['test-asset-id'],
        triggeredBy: 'proof-submission',
      },
      {
        removeOnComplete: true,
        removeOnFail: true,
      }
    )
    console.log(`✅ Test job added: ${testJob.id}`)
    
    // Get job status
    const job = await queue.getJob(testJob.id!)
    if (job) {
      const state = await job.getState()
      console.log(`✅ Job state: ${state}`)
      
      // Remove test job
      await job.remove()
      console.log('✅ Test job cleaned up')
    }
    
    console.log('\n🎉 All tests passed! Queue system is working correctly.')
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    console.error('\nTroubleshooting:')
    if (process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_URL) {
      console.error('1. Check UPSTASH_REDIS_URL or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in .env')
      console.error('2. Verify Upstash Redis credentials are correct')
      console.error('3. Ensure TLS connection is working (Upstash requires TLS)')
    } else {
      console.error('1. For production: Set UPSTASH_REDIS_URL or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN')
      console.error('2. For local dev: Make sure Redis is running: redis-cli ping')
      console.error('3. Check REDIS_HOST and REDIS_PORT in .env (local dev only)')
    }
    process.exit(1)
  } finally {
    await redisConnection.quit()
  }
}

testConnection()

