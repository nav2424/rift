# Fix Supabase Connection Issue

## Current Status

✅ Database URL is correctly configured to point to Supabase
❌ Cannot reach the database server

## Most Common Fix: Resume Paused Database

**If you're on Supabase free tier, your database pauses after 1 week of inactivity.**

### Steps to Resume:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/zosvdbzroydrwwlwlzvi
   - Or: https://supabase.com/dashboard → Select your project

2. **Look for "Paused" Status**
   - You'll see a banner or message saying the database is paused
   - Click **"Restore"** or **"Resume"** button
   - Wait 1-2 minutes for the database to wake up

3. **Test Connection Again**
   ```bash
   npx prisma db pull
   ```

## Alternative: Check Connection String Format

Your connection string should look like this:

```
DATABASE_URL=postgresql://postgres:PASSWORD@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
```

**Make sure:**
- Uses `postgresql://` (not `postgres://`)
- No square brackets around password
- Password matches exactly what's in Supabase dashboard
- No extra spaces or quotes

## If Database Isn't Paused

### Option 1: Verify Password

1. Go to Supabase Dashboard → Settings → Database
2. Click "Reveal" next to Database Password
3. Copy the password
4. Update your `.env` file:
   ```bash
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
   ```

### Option 2: Try Connection Pooling

Connection pooling often works better than direct connections:

1. Go to Supabase Dashboard → Settings → Database
2. Scroll to "Connection Pooling" section
3. Copy the "Connection String" (Session mode)
4. Update your `.env` file with that connection string

The pooled connection will look like:
```
postgresql://postgres.zosvdbzroydrwwlwlzvi:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Option 3: Check Project Status

1. Verify your project exists: https://supabase.com/dashboard
2. Check if there are any error messages in the dashboard
3. Check Supabase status page: https://status.supabase.com

## Quick Test Commands

```bash
# Test connection
npx prisma db pull

# Check what Prisma sees as DATABASE_URL (sanitized)
node -e "console.log(process.env.DATABASE_URL?.replace(/:[^@]+@/, ':***@'))" 2>/dev/null || echo "DATABASE_URL not set"

# Test network connectivity (if nc/netcat is installed)
nc -zv db.zosvdbzroydrwwlwlzvi.supabase.co 5432
```

## After Fixing

Once the connection works:

1. **Run migrations** (if you have any):
   ```bash
   npx prisma migrate dev
   ```

2. **Restart your dev server**:
   ```bash
   rm -rf .next
   npm run dev
   ```

## Still Not Working?

If none of the above works:

1. Check Supabase project logs: Dashboard → Logs → Database
2. Verify your project subscription status
3. Try creating a new Supabase project and use its connection string
4. Check if your IP is blocked by Supabase (unlikely, but possible)

