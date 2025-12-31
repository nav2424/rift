# Database URL Fix Guide

## Issue Identified

Your `DATABASE_URL` is currently pointing to an invalid host: `db.prisma.io:5432`. This is causing connection errors.

**Current (Invalid):**
```
postgres://01b8249c851c49937bef4d44df6fec740d3e83f70a6ed06bb4b8181c9a4f7c64:sk_keVmFJHUVFbB5thbNm4Su@db.prisma.io:5432/postgres?sslmode=require
```

## Solution: Get Correct Database Connection String

Since you have Supabase configured, use your Supabase PostgreSQL connection string.

### Steps to Get Supabase Database Connection String

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project (should match `zosvdbzroydrwwlwlzvi` based on your config)

2. **Navigate to Database Settings**
   - Go to **Settings** → **Database**

3. **Copy Connection String**
   - Scroll to **Connection string** section
   - Select **URI** tab (not "Pooler")
   - Copy the connection string
   - Format should be: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

4. **Update `.env.local`**
   - Replace the `DATABASE_URL` line with your Supabase connection string
   - Make sure to replace `[YOUR-PASSWORD]` with your actual database password

### Example Format (after getting from Supabase)

```env
DATABASE_URL="postgresql://postgres.your-project-ref:your-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

OR for direct connection (non-pooled):
```env
DATABASE_URL="postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres"
```

### Alternative: Use SQLite for Local Development

If you want to use SQLite locally for development:

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

2. Update `.env.local`:
   ```env
   DATABASE_URL="file:./dev.db"
   ```

3. Run migrations:
   ```bash
   npx prisma migrate dev
   ```

**Note:** SQLite is only for local development. Use PostgreSQL for production.

### After Updating DATABASE_URL

1. **Restart your dev server**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Verify connection** (optional):
   ```bash
   npx prisma db pull
   ```

3. **If using a new database, run migrations**:
   ```bash
   npx prisma migrate dev
   ```

## PrismaClient Constructor Error

If you still see `PrismaClient is not a constructor` errors after fixing the DATABASE_URL:

1. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   ```

2. **Regenerate Prisma Client:**
   ```bash
   npx prisma generate
   ```

3. **Restart dev server:**
   ```bash
   npm run dev
   ```

## Quick Fix Summary

1. Get Supabase database connection string from dashboard
2. Replace `DATABASE_URL` in `.env.local` 
3. Restart dev server
4. If issues persist, clear `.next` folder and regenerate Prisma client
