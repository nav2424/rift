# Cron Job Setup for Auto-Release

The Hybrid Protection System includes an auto-release feature that automatically releases funds after the grace period expires. This requires a scheduled job (cron) to call the auto-release endpoint periodically.

## Quick Setup

### Option 1: Vercel Cron (Recommended for Vercel Deployments)

If you're deploying to Vercel, cron jobs are automatically configured via `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/escrows/auto-release",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Schedule**: Runs every hour (`0 * * * *`)

**Security**: Add `CRON_SECRET` environment variable in Vercel:
1. Go to Project Settings → Environment Variables
2. Add: `CRON_SECRET` = `your-secure-random-string`
3. The endpoint will verify this secret before processing

### Option 2: External Cron Service

For other hosting platforms, use an external cron service:

#### Using cron-job.org (Free)
1. Sign up at https://cron-job.org
2. Create a new cron job:
   - **URL**: `https://your-domain.com/api/escrows/auto-release`
   - **Schedule**: Every hour
   - **Method**: POST
   - **Headers**: 
     - `Authorization: Bearer YOUR_CRON_SECRET`
     - `Content-Type: application/json`

#### Using EasyCron
1. Sign up at https://www.easycron.com
2. Configure similar to above

#### Using GitHub Actions (Free for public repos)
Create `.github/workflows/auto-release.yml`:

```yaml
name: Auto-Release Cron

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Manual trigger

jobs:
  auto-release:
    runs-on: ubuntu-latest
    steps:
      - name: Call Auto-Release API
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            https://your-domain.com/api/escrows/auto-release
```

Add `CRON_SECRET` to GitHub Secrets (Settings → Secrets and variables → Actions)

### Option 3: Server Cron (Self-Hosted)

If you're running your own server, add to crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs every hour)
0 * * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/escrows/auto-release
```

Or create a script file (`/usr/local/bin/auto-release.sh`):

```bash
#!/bin/bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://your-domain.com/api/escrows/auto-release
```

Make executable: `chmod +x /usr/local/bin/auto-release.sh`

Then add to crontab:
```
0 * * * * /usr/local/bin/auto-release.sh
```

## Security

### Setting CRON_SECRET

1. **Generate a secure secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Set in environment variables**:
   - Development: Add to `.env` file
   - Production: Set in hosting platform (Vercel, Railway, etc.)

3. **The endpoint verifies**:
   ```typescript
   // If CRON_SECRET is set, the endpoint requires:
   Authorization: Bearer YOUR_CRON_SECRET
   ```

## Testing

### Test Locally

1. **Start your dev server**:
   ```bash
   npm run dev
   ```

2. **Run auto-release manually**:
   ```bash
   npm run cron:auto-release
   ```

   Or with curl:
   ```bash
   curl -X POST http://localhost:3000/api/escrows/auto-release
   ```

### Test End-to-End Flow

Run the test script:
```bash
npm run test:hybrid-flow
```

This will:
- Create test escrow
- Verify shipment proof
- Set grace period
- Check auto-release eligibility

## Monitoring

### Check Logs

The auto-release endpoint returns results:
```json
{
  "success": true,
  "processed": 2,
  "results": [
    { "escrowId": "...", "success": true },
    { "escrowId": "...", "success": false, "error": "..." }
  ]
}
```

### Set Up Alerts

Monitor the cron job to ensure it's running:
- Vercel: Check Function Logs in dashboard
- External services: Use their monitoring features
- Server: Check cron logs (`/var/log/cron`)

## Schedule Options

Current schedule: Every hour (`0 * * * *`)

Other options:
- Every 30 minutes: `*/30 * * * *`
- Every 15 minutes: `*/15 * * * *`
- Every day at midnight: `0 0 * * *`
- Every 6 hours: `0 */6 * * *`

**Recommendation**: Hourly is sufficient for most use cases. The grace period is 48 hours, so hourly checks provide plenty of precision.

## Troubleshooting

### Cron Not Running

1. **Check endpoint is accessible**:
   ```bash
   curl https://your-domain.com/api/escrows/auto-release
   ```

2. **Check logs**:
   - Vercel: Function Logs
   - Server: `/var/log/cron` or cron service logs

3. **Test manually**:
   ```bash
   curl -X POST https://your-domain.com/api/escrows/auto-release
   ```

### 401 Unauthorized

- Verify `CRON_SECRET` is set in environment variables
- Check Authorization header format: `Bearer YOUR_SECRET`
- Restart server after setting environment variable

### No Escrows Processed

This is normal if:
- No escrows are past grace period
- All escrows have open disputes
- All escrows are already released

Check the response for details.

## Manual Override

If needed, you can manually trigger auto-release:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/escrows/auto-release
```

Or use the GET endpoint (no auth required in development):
```bash
curl https://your-domain.com/api/escrows/auto-release
```

