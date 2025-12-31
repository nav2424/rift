# Environment Variables Explained

## Two Different URLs for Supabase

Supabase uses **two different URLs** for different purposes:

### 1. `DATABASE_URL` (PostgreSQL Connection String)
**Used by:** Prisma, direct database connections

**Format:**
```
postgresql://postgres:PASSWORD@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
```

**Your current value:**
```
DATABASE_URL=postgresql://postgres:i1eTjEwbrXB3rvsL@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
```

✅ **This is CORRECT!** Don't change it.

**Key characteristics:**
- Uses `postgresql://` protocol (not `https://`)
- Host: `db.zosvdbzroydrwwlwlzvi.supabase.co` (with `db.` prefix)
- Port: `5432` (PostgreSQL port)
- Includes username (`postgres`) and password
- Includes database name (`/postgres`)

### 2. `NEXT_PUBLIC_SUPABASE_URL` (API Endpoint)
**Used by:** Supabase client library, API calls

**Format:**
```
https://zosvdbzroydrwwlwlzvi.supabase.co
```

**Your current value (should be in `.env.local`):**
```
NEXT_PUBLIC_SUPABASE_URL=https://zosvdbzroydrwwlwlzvi.supabase.co
```

✅ **This is also CORRECT!** Keep it as is.

**Key characteristics:**
- Uses `https://` protocol
- Host: `zosvdbzroydrwwlwlzvi.supabase.co` (without `db.` prefix)
- No port (uses default HTTPS port 443)
- No credentials (uses API keys instead)

## Summary

| Variable | Purpose | Format | Example |
|----------|---------|--------|---------|
| `DATABASE_URL` | Prisma/PostgreSQL connection | `postgresql://user:pass@db.PROJECT.supabase.co:5432/postgres` | ✅ You have this correct |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API/Client | `https://PROJECT.supabase.co` | ✅ You have this correct |

## Why Two Different URLs?

- **DATABASE_URL**: Direct PostgreSQL connection for Prisma ORM to manage your database schema and run queries
- **NEXT_PUBLIC_SUPABASE_URL**: Supabase API endpoint for using Supabase's client library features (auth, storage, realtime, etc.)

Both are needed for your application, and they serve different purposes!

## Current Issue

Your `DATABASE_URL` is correctly configured. The connection issue is likely because:
1. Your Supabase database is paused (most common with free tier)
2. Password might be incorrect
3. Network connectivity issue

**Fix**: Resume your database in Supabase dashboard, then try `npx prisma db pull` again.

