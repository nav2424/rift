# 🔴 URGENT: Connect to Correct Database

## Problem
Your app is connected to a database, but it's the WRONG one (showing 0 users/transactions when you have 18 users and 27+ transactions).

## Solution: Use Direct Connection String

The pooler connection might be routing to a different database. Use the DIRECT connection instead.

### Steps:

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard/project/zosvdbzroydrwwlwlzvi/settings/database

2. **Get Direct Connection String**
   - Scroll to "Connection string" section
   - Click **"URI"** tab (NOT "Session mode" or "Transaction mode")
   - Copy the connection string
   - It should look like:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
     ```

3. **Update .env file**
   - Open `.env`
   - Find `DATABASE_URL=`
   - Replace with the DIRECT connection string (from step 2)
   - Make sure it uses `db.zosvdbzroydrwwlwlzvi.supabase.co` (NOT `pooler.supabase.com`)

4. **Restart dev server**
   ```bash
   rm -rf .next
   npm run dev
   ```

## Why This Happens
- Pooler connections (`pooler.supabase.com`) can sometimes route to different databases
- Direct connections (`db.PROJECT.supabase.co`) always connect to your specific database
- Your data is in the direct database, not the pooler

After updating, you should see your 18 users and 27+ transactions!
