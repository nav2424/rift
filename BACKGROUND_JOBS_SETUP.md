# Background Jobs Setup Guide

## Overview

The Rift system now uses **BullMQ** with **Redis** for asynchronous job processing. This allows heavy operations like verification and virus scanning to run in the background without blocking HTTP responses.

## Prerequisites

1. **Redis Server** - Required for BullMQ
2. **Node.js** - Already installed

## Installation

### 1. Install Redis

**macOS (using Homebrew):**
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

**Windows:**
Download from: https://github.com/microsoftarchive/redis/releases
Or use WSL with Linux instructions above.

### 2. Verify Redis is Running

```bash
redis-cli ping
# Should return: PONG
```

### 3. Environment Variables

Add to your `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional, leave empty if no password
REDIS_DB=0       # Optional, defaults to 0
```

**Production:**
- Use a managed Redis service (Redis Cloud, AWS ElastiCache, etc.)
- Set `REDIS_HOST` to your Redis server URL
- Set `REDIS_PASSWORD` if required
- Use SSL/TLS connection if supported

## Running Workers

### Development

Run the verification worker in a separate terminal:

```bash
npm run worker:verification
```

Or run it alongside the dev server:

```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Verification worker
npm run worker:verification
```

### Production

#### Option 1: Separate Process (Recommended)

Use a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start worker
pm2 start workers/verification-worker.ts --interpreter tsx --name verification-worker

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Option 2: Docker

Add to your Dockerfile:

```dockerfile
# Run worker as separate service
CMD ["node", "workers/verification-worker.js"]
```

Or use docker-compose:

```yaml
services:
  app:
    # Your Next.js app
  
  verification-worker:
    build: .
    command: npm run worker:verification
    env_file: .env
    depends_on:
      - redis
      - app
```

#### Option 3: Vercel Background Functions

For Vercel deployments, you can use Vercel Background Functions or run workers on a separate server.

## Queue Monitoring

### BullMQ Board (Optional)

Install BullMQ Board for monitoring:

```bash
npm install @bull-board/api @bull-board/express
```

Create `workers/monitor.ts`:

```typescript
import express from 'express'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { getQueue, QUEUE_NAMES } from '../lib/queue/config'

const app = express()

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
  queues: [
    new BullMQAdapter(getQueue(QUEUE_NAMES.VERIFICATION)),
    // Add other queues here
  ],
  serverAdapter,
})

app.use('/admin/queues', serverAdapter.getRouter())

app.listen(3001, () => {
  console.log('BullMQ Board running on http://localhost:3001/admin/queues')
})
```

## Job Types

### 1. Verification Jobs (`rift-verification`)

**Purpose:** Asynchronously verify proof quality and integrity

**Triggered By:**
- Proof submission
- Admin manual verification
- Retry after failure

**Worker:** `workers/verification-worker.ts`

**Status Endpoint:** `GET /api/rifts/[id]/verification-status`

### 2. Virus Scan Jobs (`rift-virus-scan`)

**Purpose:** Scan uploaded files for malware (not yet implemented)

**Status:** Coming soon

### 3. Cleanup Jobs (`rift-cleanup`)

**Purpose:** Clean up assets when rifts are cancelled (not yet implemented)

**Status:** Coming soon

## API Changes

### Proof Submission

**Before (Synchronous):**
```typescript
// Blocked for 10-30 seconds
const result = await verifyRiftProofs(riftId)
return { success: true, result }
```

**After (Asynchronous):**
```typescript
// Returns immediately
const jobId = await queueVerificationJob(riftId, assetIds)
return { 
  success: true, 
  verificationJobId: jobId,
  status: 'PENDING'
}
```

### Verification Status

**New Endpoint:** `GET /api/rifts/[id]/verification-status`

**Response:**
```json
{
  "jobId": "verification-abc123-1234567890",
  "state": "completed",
  "status": "completed",
  "result": {
    "success": true,
    "allPassed": true,
    "shouldRouteToReview": false
  }
}
```

**States:**
- `pending` - Job is queued, waiting to start
- `processing` - Job is currently running
- `completed` - Job finished successfully
- `failed` - Job failed with error

## Troubleshooting

### Redis Connection Error

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution:**
1. Ensure Redis is running: `redis-cli ping`
2. Check `REDIS_HOST` and `REDIS_PORT` in `.env`
3. Verify Redis is accessible from your application

### Jobs Not Processing

**Check:**
1. Worker is running: `npm run worker:verification`
2. Worker logs show it's waiting for jobs
3. Redis connection is working
4. Jobs are being added to the queue (check logs)

### Jobs Failing

**Check worker logs:**
```bash
npm run worker:verification
# Look for error messages
```

**Common Issues:**
- Database connection errors
- Missing environment variables
- File access errors (Supabase)
- Network timeouts

### High Memory Usage

**Solutions:**
1. Reduce job retention: Adjust `removeOnComplete` in queue config
2. Reduce concurrency: Lower `concurrency` in worker options
3. Increase Redis max memory: `maxmemory 256mb` in redis.conf

## Production Checklist

- [ ] Redis server is set up and accessible
- [ ] Environment variables are configured
- [ ] Workers are running (PM2, Docker, or separate server)
- [ ] Monitoring is set up (optional: BullMQ Board)
- [ ] Error alerts are configured
- [ ] Job retention policies are set
- [ ] Redis backup is configured
- [ ] Load testing completed

## Next Steps

1. **Virus Scanning** - Implement virus scan worker
2. **Cleanup Jobs** - Implement asset cleanup worker
3. **Email Queue** - Move email sending to background jobs
4. **Monitoring Dashboard** - Set up BullMQ Board
5. **Rate Limiting** - Add per-user job limits

---

**Last Updated:** January 22, 2025

