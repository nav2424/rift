# Get the Correct Database Connection String

## Problem
The app is connecting to a database, but it's showing 0 users/transactions when you have 18 users and 27+ transactions. This means we're connected to the WRONG database.

## Solution: Get the Exact Connection String

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard/project/zosvdbzroydrwwlwlzvi/settings/database

2. **Find "Connection string" section**
   - Scroll down to see connection options

3. **Copy the URI connection string**
   - Click the **"URI"** tab (NOT "Session mode" or "Transaction mode")
   - Copy the ENTIRE string - it should look like:
     ```
     postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:6543/postgres
     ```
     OR
     ```
     postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     ```

4. **Update your .env file**
   - Replace the `DATABASE_URL=` line with the exact connection string you copied
   - Make sure it starts with `postgresql://` (not `https://`)

5. **Restart dev server**
   ```bash
   rm -rf .next
   npm run dev
   ```

## Why This Matters
Different connection strings can point to different database instances. The exact connection string from your Supabase dashboard will connect to the database with your 18 users and 27+ transactions.
