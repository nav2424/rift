# Fix: Use Connection Pooling Instead

## Problem

Your direct database connection (port 5432) isn't working, even though the database is active.

## Solution: Use Connection Pooling

Connection pooling is more reliable and works better with Supabase. Here's how to switch:

### Step 1: Get Connection Pooling String

1. Go to **Supabase Dashboard** → **Settings** → **Database**
2. Scroll down to **"Connection Pooling"** section
3. Click on **"Connection String"** tab (Session mode)
4. **Copy** the entire connection string

It will look something like:
```
postgresql://postgres.zosvdbzroydrwwlwlzvi:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Key differences from direct connection:**
- Uses `postgres.zosvdbzroydrwwlwlzvi` (with project ref in username)
- Goes through `pooler.supabase.com` (not `db.PROJECT.supabase.co`)
- Uses port `6543` (not `5432`)

### Step 2: Update Your .env File

Replace your current `DATABASE_URL` line with the pooled connection string:

**Before (direct connection - not working):**
```
DATABASE_URL=postgresql://postgres:i1eTjEwbrXB3rvsL@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
```

**After (connection pooling - should work):**
```
DATABASE_URL=postgresql://postgres.zosvdbzroydrwwlwlzvi:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

*(Replace `YOUR_PASSWORD` with the actual password from the connection string you copied)*

### Step 3: Test the Connection

```bash
npx prisma db pull
```

This should now work!

## Why Connection Pooling?

- More reliable connections
- Better for serverless/edge functions
- Handles connection limits better
- Recommended by Supabase for most use cases

## Alternative: Verify Direct Connection Password

If you want to stick with direct connection, make sure:

1. Go to Settings → Database → Reveal Database Password
2. Compare it exactly with what's in your `.env` file
3. Make sure there are no spaces or extra characters
4. If password has special characters, they might need URL encoding

But honestly, **connection pooling is the better choice** and will likely fix your issue immediately!

