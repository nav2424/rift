# Supabase Connection Troubleshooting

## Current Status

✅ **Fixed**: Database URL is now pointing to the correct Supabase host (`db.zosvdbzroydrwwlwlzvi.supabase.co`)
❌ **Issue**: Can't reach the database server

## Possible Causes & Solutions

### 1. Supabase Database is Paused (Most Likely - Free Tier)

**Free tier Supabase databases pause after 1 week of inactivity.**

**Solution:**
1. Go to https://supabase.com/dashboard/project/zosvdbzroydrwwlwlzvi
2. Your database might show as "Paused" 
3. Click **"Restore"** or **"Resume"** to wake it up
4. Wait 1-2 minutes for the database to start
5. Try connecting again

### 2. Database Password is Incorrect

**Check:**
1. Go to Supabase Dashboard → Settings → Database
2. Click "Show" or "Reveal" next to the database password
3. Verify it matches what's in your `.env` file
4. If it doesn't match, update your `.env` file with the correct password

**To update password:**
```bash
# Edit .env file and update the password part:
DATABASE_URL=postgresql://postgres:CORRECT_PASSWORD_HERE@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
```

### 3. Network/Firewall Issues

**Test connectivity:**
```bash
# Test if you can reach the database host
nc -zv db.zosvdbzroydrwwlwlzvi.supabase.co 5432

# Or try with telnet
telnet db.zosvdbzroydrwwlwlzvi.supabase.co 5432
```

If these fail, there might be a network issue.

### 4. Connection String Format Issue

Make sure your connection string format is correct:

**Correct format:**
```
postgresql://postgres:PASSWORD@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
```

**Common mistakes:**
- Missing `postgresql://` prefix (should NOT be just `postgres://`)
- Password has special characters that need URL encoding
- Extra spaces or quotes

### 5. Supabase Project Doesn't Exist or Was Deleted

**Verify:**
1. Go to https://supabase.com/dashboard
2. Check if your project `zosvdbzroydrwwlwlzvi` still exists
3. If it doesn't exist, you'll need to create a new project and get a new connection string

### 6. Connection Pooling (Alternative)

If direct connection doesn't work, try using Supabase's connection pooling:

**Get connection pooling string:**
1. Go to Supabase Dashboard → Settings → Database
2. Scroll to "Connection Pooling" section
3. Copy the "Connection String" (Session mode)
4. Use that as your `DATABASE_URL` instead

The pooled connection uses port `6543` instead of `5432` and goes through `aws-0-us-east-1.pooler.supabase.com`.

### Quick Diagnostic Steps

1. **Check if database is paused:**
   - Visit: https://supabase.com/dashboard/project/zosvdbzroydrwwlwlzvi
   - Look for "Paused" status

2. **Verify password:**
   - Dashboard → Settings → Database → Reveal password
   - Compare with your `.env` file

3. **Test connection manually:**
   ```bash
   npx prisma db pull
   ```
   This will try to connect and show a more detailed error message.

4. **Check Supabase logs:**
   - Dashboard → Logs → Database
   - See if there are any connection errors logged

## Next Steps

1. **First**: Check if your database is paused and resume it if needed
2. **Second**: Verify the password matches exactly
3. **Third**: Try using the connection pooling URL instead
4. **Fourth**: If still failing, check Supabase status page or contact support

## Connection String Examples

**Direct connection (current):**
```
postgresql://postgres:password@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
```

**Connection pooling (alternative):**
```
postgresql://postgres.zosvdbzroydrwwlwlzvi:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

