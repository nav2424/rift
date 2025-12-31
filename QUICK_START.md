# Quick Start - Background Jobs System

## Setup Redis (Required)

### macOS
```bash
brew install redis
brew services start redis
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

### Docker
```bash
docker run -d -p 6379:6379 redis:alpine
```

### Verify Redis is Running
```bash
redis-cli ping
# Should return: PONG
```

## Environment Variables

Add to `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Run the System

### Development

**Terminal 1:** Start Next.js
```bash
npm run dev
```

**Terminal 2:** Start Worker
```bash
npm run worker:verification
```

## Test It

1. Submit a proof via the UI or API
2. Check logs in Terminal 2 - should see verification job processing
3. Check status: `GET /api/rifts/{riftId}/verification-status`

## What's Working

✅ Proof submission queues verification job (returns immediately)  
✅ Worker processes verification asynchronously  
✅ Status endpoint shows verification progress  
✅ State transitions happen automatically when verification completes  

## Next Steps

- Set up Redis in production
- Deploy worker process (PM2, Docker, or separate server)
- Implement virus scanning queue (Phase 2)
- Add UI status polling (Phase 2)

