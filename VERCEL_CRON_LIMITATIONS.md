# Vercel Cron Job Limitations

## Issue

Vercel's **Hobby (free) plan** limits cron jobs to **once per day maximum**.

The auto-release cron job was set to run every hour (`0 * * * *`), which exceeds this limit.

## Solution Applied

Updated `vercel.json` to run auto-release **once per day** at 2 AM UTC:

```json
{
  "crons": [
    {
      "path": "/api/rifts/auto-release",
      "schedule": "0 2 * * *"  // Runs once per day at 2 AM UTC
    },
    {
      "path": "/api/payouts/process",
      "schedule": "0 9 * * *"  // Runs once per day at 9 AM UTC
    }
  ]
}
```

## Impact

**Before:** Auto-release ran every hour (24 times/day)
**Now:** Auto-release runs once per day at 2 AM UTC

### What This Means

- **Rifts will still auto-release**, but with up to 24 hours delay instead of 1 hour
- The grace period (48 hours) remains the same
- Funds will be released between 48-72 hours after delivery (instead of 48-49 hours)

**Example:**
- Buyer confirms delivery at 3 PM
- Grace period ends at 3 PM + 48 hours = 3 PM (2 days later)
- Auto-release runs at 2 AM UTC the next day
- Funds released approximately 11 hours after grace period ends

## Alternatives

### Option 1: Keep Daily Schedule (Current - Recommended for Free Tier)
- ✅ Works on Vercel Hobby plan
- ✅ No additional cost
- ⚠️ Up to 24 hour delay (acceptable for most use cases)

### Option 2: Upgrade to Vercel Pro Plan
- ✅ Run cron jobs every hour or more frequently
- ✅ Better performance and features
- 💰 Costs $20/month

### Option 3: Use External Cron Service
- ✅ More frequent runs possible
- ✅ Free options available (e.g., cron-job.org, EasyCron)
- ⚠️ Requires external service setup
- Configure to call: `https://your-domain.vercel.app/api/rifts/auto-release`

### Option 4: Manual Release Trigger
- ✅ Users can manually release funds
- ✅ No cron job needed
- ⚠️ Relies on user action

### Option 5: Remove Cron, Use Webhook/Polling
- ✅ Real-time processing
- ⚠️ More complex implementation
- ⚠️ May require additional infrastructure

## Recommended Approach

For **development/early production**: Keep the daily schedule (Option 1)
- Works with free Vercel plan
- 24-hour delay is acceptable for most transactions
- Can upgrade later if needed

For **production with high volume**: Consider Option 2 or 3
- If you need faster releases
- If transaction volume justifies the cost

## Testing

After deployment, verify cron jobs are working:

1. **Check Vercel Dashboard** → Your Project → Cron Jobs
2. **Check logs** after scheduled time
3. **Monitor** that rifts are being auto-released

## Changing the Schedule

To change when the cron runs, edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/rifts/auto-release",
      "schedule": "0 2 * * *"  // Change this line
    }
  ]
}
```

**Cron schedule format:** `minute hour day month weekday`

Examples:
- `0 2 * * *` - Daily at 2 AM UTC
- `0 */12 * * *` - Every 12 hours (requires Pro plan)
- `0 * * * *` - Every hour (requires Pro plan)
- `*/15 * * * *` - Every 15 minutes (requires Pro plan)

## Need More Frequent Runs?

If you need auto-release to run more frequently:

1. **Upgrade to Vercel Pro** ($20/month)
   - Allows unlimited cron job frequency
   - Change schedule back to `0 * * * *` (hourly) or more frequent

2. **Use External Cron Service** (Free options available)
   - Set up at cron-job.org or similar
   - Call your API endpoint on any schedule you want
   - Remember to add authentication (e.g., `CRON_SECRET` header)

---

**Note:** The current daily schedule should work fine for most use cases. You can always upgrade later if needed!

