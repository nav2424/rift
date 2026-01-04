# Upstash Redis Setup Guide for Vercel

## ✅ Quick Setup Steps

### Step 1: Get Redis Protocol URL from Upstash

1. In your Upstash dashboard, click on your **RIFT** database
2. Navigate to the **Details** or **Connect** tab
3. Look for **"Redis URL"** or **"Connect via Redis"** section
4. Copy the Redis protocol URL (it should look like):
   ```
   rediss://default:AXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@ca-central-1-xxxx-xxxxx.upstash.io:6380
   ```

### Step 2: Set Environment Variables in Vercel

**Option A: Using Redis Protocol URL (Recommended)**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add a new variable:
   - **Name**: `UPSTASH_REDIS_URL`
   - **Value**: The full Redis URL you copied (starts with `rediss://`)
   - **Environment**: Select all (Production, Preview, Development)
3. Click **Save**

**Option B: Using REST URL + Token (If Redis URL not available)**

1. In Upstash dashboard, find:
   - **UPSTASH_REDIS_REST_URL**: `https://ca-central-1-xxxx-xxxxx.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN**: Your token (starts with `AXxxxxx...`)

2. In Vercel, add both variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### Step 3: Redeploy

After setting environment variables:
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click **Redeploy** on the latest deployment (or trigger a new deployment)
3. Wait for deployment to complete

### Step 4: Verify Connection

1. Check Vercel Function Logs:
   - Go to Vercel Dashboard → Your Project → Functions
   - Check for Redis connection errors
   - You should see fewer or no timeout errors

2. Test in your application:
   - Try using features that require Redis/queues
   - Check Upstash dashboard - you should see commands increasing

## 🔍 Troubleshooting

### If you still see connection timeout errors:

1. **Verify Environment Variables:**
   - Check that variables are set for the correct environment (Production/Preview)
   - Ensure values don't have extra spaces or quotes
   - Make sure variable names match exactly: `UPSTASH_REDIS_URL` (all uppercase)

2. **Check Redis URL Format:**
   - Should start with `rediss://` (with double 's' for TLS)
   - Should include port `:6380`
   - Format: `rediss://default:[token]@[hostname]:6380`

3. **Network/Firewall Issues:**
   - Vercel functions should be able to connect to Upstash
   - If using VPC, ensure Redis endpoint is accessible

4. **Upstash Region:**
   - Your Redis is in `ca-central-1` (Central Canada)
   - Make sure your Vercel region is compatible (most are)
   - Consider using a region closer to your users if needed

## 📊 Monitoring

After setup, monitor in Upstash dashboard:
- **Daily Commands**: Should increase when Redis is working
- **Daily Bandwidth**: Should show consistent usage
- **Connection Errors**: Should be minimal

## 🔗 Useful Links

- [Upstash Redis Dashboard](https://console.upstash.com/redis)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)

