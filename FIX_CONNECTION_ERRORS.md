# Fix PostgreSQL Connection Errors

## Problem
You're seeing "Error in PostgreSQL connection: Error { kind: Closed, cause: None }" errors.

## Solution
Add connection pooling parameters to your `DATABASE_URL` in the `.env` file.

## Steps

1. Open your `.env` file
2. Find the line with `DATABASE_URL=`
3. Add these parameters to the end of the URL (before any existing `?` parameters):

```
?connection_limit=10&pool_timeout=20&connect_timeout=10&pgbouncer=true
```

## Example

**Before:**
```
DATABASE_URL=postgresql://postgres.zosvdbzroydrwwlwlzvi:password@aws-1-ca-central-1.pooler.supabase.com:5432/postgres
```

**After:**
```
DATABASE_URL=postgresql://postgres.zosvdbzroydrwwlwlzvi:password@aws-1-ca-central-1.pooler.supabase.com:5432/postgres?connection_limit=10&pool_timeout=20&connect_timeout=10&pgbouncer=true
```

## What These Parameters Do

- `connection_limit=10`: Limits the number of connections in the pool
- `pool_timeout=20`: Maximum time to wait for a connection from the pool (seconds)
- `connect_timeout=10`: Maximum time to establish a connection (seconds)
- `pgbouncer=true`: Tells Prisma you're using PgBouncer (Supabase's connection pooler)

## After Updating

1. Save the `.env` file
2. Restart your dev server (Ctrl+C, then `npm run dev`)

The connection errors should be resolved!
