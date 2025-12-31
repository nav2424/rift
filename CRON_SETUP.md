# Cron Job Setup for Auto-Release and Payout Processing

This document describes the cron jobs required for Rift to function properly.

## Required Cron Jobs

### 1. Auto-Release Cron (`/api/rifts/auto-release`)
Automatically releases funds for rifts that have passed their auto-release deadline.

**Schedule**: Every hour (`0 * * * *`)
**Endpoint**: `/api/rifts/auto-release`
**Method**: POST

### 2. Payout Processing Cron (`/api/payouts/process`)
Processes scheduled payouts that are ready to be sent to sellers.

**Schedule**: Daily at 9 AM UTC (`0 9 * * *`)
**Endpoint**: `/api/payouts/process`
**Method**: POST
**Authentication**: Requires `CRON_SECRET` environment variable

## Option 1: Vercel Cron (Recommended for Vercel deployments)

Add to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/rifts/auto-release",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/payouts/process",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**Schedules Explained**:
- `"0 * * * *"` - Every hour at minute 0
- `"0 9 * * *"` - Daily at 9:00 AM UTC

### Steps:
1. Add the cron configuration to `vercel.json`
2. Set `CRON_SECRET` environment variable in Vercel (for payout processing)
3. Deploy to Vercel
4. Vercel will automatically set up the cron jobs

## Option 2: External Cron Service

Use a service like:
- **cron-job.org** (free)
- **EasyCron** (free tier available)
- **UptimeRobot** (free tier)
- **GitHub Actions** (for free tier)

### Example using cron-job.org:

#### Auto-Release Cron:
1. Sign up at https://cron-job.org
2. Create a new cron job
3. Set URL: `https://your-domain.com/api/rifts/auto-release`
4. Set method: `POST`
5. Set schedule: Every hour
6. Save and activate

#### Payout Processing Cron:
1. Create another cron job
2. Set URL: `https://your-domain.com/api/payouts/process`
3. Set method: `POST`
4. Add header: `Authorization: Bearer YOUR_CRON_SECRET`
5. Set schedule: Daily at 9 AM UTC
6. Save and activate

### Example using GitHub Actions:

Create `.github/workflows/cron-jobs.yml`:

```yaml
name: Rift Cron Jobs

on:
  schedule:
    - cron: '0 * * * *'  # Auto-release: Every hour
    - cron: '0 9 * * *'  # Payout processing: Daily at 9 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  auto-release:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Auto-Release
        run: |
          curl -X POST https://your-domain.com/api/rifts/auto-release \
            -H "Content-Type: application/json"

  payout-processing:
    runs-on: ubuntu-latest
    steps:
      - name: Process Payouts
        run: |
          curl -X POST https://your-domain.com/api/payouts/process \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

## Environment Variables

### Required:
- `CRON_SECRET` - Secret token for authenticating payout processing cron (recommended)

The auto-release endpoint doesn't require authentication (handles public webhook-style calls), but payout processing should be protected.

## Testing

### Test Auto-Release:
```bash
curl -X POST https://your-domain.com/api/rifts/auto-release
```

### Test Payout Processing:
```bash
curl -X POST https://your-domain.com/api/payouts/process \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Local Testing:
```bash
# Auto-release
curl -X POST http://localhost:3000/api/rifts/auto-release

# Payout processing
curl -X POST http://localhost:3000/api/payouts/process \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Monitoring

Both endpoints return JSON responses with:
- Success status
- Number of items processed
- Any errors that occurred
- Summary of actions taken

### Auto-Release Response:
```json
{
  "success": true,
  "processed": 5,
  "results": [...]
}
```

### Payout Processing Response:
```json
{
  "success": true,
  "processed": 3,
  "results": [...]
}
```

## Troubleshooting

### Cron jobs not running:
1. Verify `vercel.json` is deployed
2. Check Vercel dashboard for cron job status
3. Verify environment variables are set
4. Check endpoint logs for errors

### Authentication errors (payout processing):
1. Verify `CRON_SECRET` is set in environment variables
2. Check that Authorization header matches exactly: `Bearer YOUR_SECRET`
3. Verify the secret is correctly configured in your cron service

### No items processed:
- This is normal if there are no eligible rifts/payouts
- Check database to verify there are items that should be processed
- Verify schedule times are correct (UTC)
