# Test Database Connection - Alternative Methods

Since your database is active (not paused), let's try other troubleshooting steps:

## 1. Verify Password in Supabase Dashboard

1. Go to: Settings → Database
2. Click "Reveal" or "Show" next to "Database Password"
3. Compare it exactly with what's in your `.env` file

**Important**: Make sure there are no extra spaces, and special characters match exactly.

## 2. Try Connection Pooling URL Instead

Connection pooling often works better than direct connections:

1. Go to Supabase Dashboard → Settings → Database
2. Scroll down to "Connection Pooling" section
3. Copy the "Connection String" (Session mode)
4. It will look like:
   ```
   postgresql://postgres.zosvdbzroydrwwlwlzvi:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
5. Replace your `DATABASE_URL` in `.env` with this pooled connection string

## 3. Check if Password Needs URL Encoding

If your password has special characters, they might need to be URL-encoded in the connection string.

**Current password in your connection string**: `i1eTjEwbrXB3rvsL`

If the actual password in Supabase has special characters that aren't URL-encoded, that could cause connection issues.

## 4. Verify Connection String Format

Your current connection string:
```
DATABASE_URL=postgresql://postgres:i1eTjEwbrXB3rvsL@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
```

**Make sure:**
- No quotes around the entire string (unless needed)
- No extra spaces
- Password matches exactly what's shown in Supabase dashboard
- Uses `postgresql://` (not `postgres://`)

## 5. Test with psql (if installed)

If you have `psql` installed, you can test the connection directly:

```bash
psql "postgresql://postgres:i1eTjEwbrXB3rvsL@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres"
```

This will give you a more detailed error message.

## 6. Check Supabase Logs

1. Go to Supabase Dashboard → Logs → Database
2. Look for any connection errors or authentication failures
3. This might give clues about what's wrong

## Quick Fix to Try First

**Most likely fix**: Use the Connection Pooling URL instead of the direct connection:

1. Get the pooled connection string from Supabase Dashboard → Settings → Database → Connection Pooling
2. Update your `.env` file with that connection string
3. Try `npx prisma db pull` again

Connection pooling (port 6543) is more reliable than direct connections (port 5432) for most use cases.

