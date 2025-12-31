# How to Get Your Supabase Database Password

Even if you login to Supabase with GitHub, your PostgreSQL database has its own password. Here's how to find it:

## Method 1: Get Password from Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project (the one with `zosvdbzroydrwwlwlzvi`)

2. **Navigate to Database Settings**
   - Click on **Settings** (gear icon in left sidebar)
   - Click on **Database** in the settings menu

3. **Find Connection String with Password**
   - Scroll down to the **Connection string** section
   - You'll see different connection string formats
   - Look for the **URI** format - it will have the password already included!
   - Format: `postgresql://postgres:[YOUR-PASSWORD-HERE]@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres`

4. **Copy the Entire Connection String**
   - Just copy the whole connection string - it already includes the password
   - You don't need to manually replace `[YOUR-PASSWORD]` - it's already filled in!

## Method 2: Reset Database Password (If you can't find it)

If the password is not visible or you need to reset it:

1. **Go to Settings → Database**
2. **Scroll to "Database Password" section**
3. **Click "Reset Database Password"** or **"Show Database Password"**
4. **Copy the password** that appears
5. **Use it in your connection string**

## Method 3: Use Connection Pooling (Alternative)

Supabase also provides connection pooling URLs that might be easier to use:

1. **In Settings → Database**
2. **Look for "Connection Pooling" section**
3. **Copy the "Connection String" (Session mode)**
4. **Use that as your `DATABASE_URL`**

The pooled connection string format:
```
postgresql://postgres.zosvdbzroydrwwlwlzvi:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## Quick Steps to Update Your .env.local

1. Go to Supabase Dashboard → Settings → Database
2. Find the **Connection string** section
3. Click on the **URI** tab
4. **Copy the entire connection string** (it already includes the password)
5. Paste it into your `.env.local` file:

```env
DATABASE_URL="postgresql://postgres:your-actual-password-here@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres"
```

**Important:** The connection string from Supabase dashboard will already have the password filled in - you just need to copy the whole thing!

## Security Note

⚠️ **Never commit your `.env.local` file to git!** It contains sensitive passwords. Make sure `.env.local` is in your `.gitignore` file.

## After Updating DATABASE_URL

1. **Restart your dev server:**
   ```bash
   # Stop server (Ctrl+C)
   rm -rf .next  # Clear cache
   npm run dev   # Restart
   ```

2. **Test the connection:**
   ```bash
   npx prisma db pull
   ```

3. **If it's a new database, run migrations:**
   ```bash
   npx prisma migrate dev
   ```
