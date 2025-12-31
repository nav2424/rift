# Fix: Authentication Failed (Password Issue)

## Good News! 🎉

The error changed from:
- ❌ **Before**: `Can't reach database server` (connection issue)
- ✅ **Now**: `Authentication failed` (connection works, but password is wrong)

This means your connection string format is **correct**! The issue is just the password.

## Fix: Verify and Update Password

### Step 1: Get the Correct Password from Supabase

1. Go to **Supabase Dashboard** → **Settings** → **Database**
2. Find **"Database password"** section
3. Click **"Reveal"** or **"Show"** button
4. **Copy the password EXACTLY** as shown
5. **Important**: Make sure there are no extra spaces before/after

### Step 2: Update Your .env File

Your connection string should look like:
```
DATABASE_URL=postgresql://postgres.zosvdbzroydrwwlwlzvi:YOUR_CORRECT_PASSWORD@aws-1-ca-central-1.pooler.supabase.com:5432/postgres
```

Replace `YOUR_CORRECT_PASSWORD` with the password you just copied from Supabase.

**Make sure:**
- ✅ No brackets `[]` around the password
- ✅ No spaces before or after the password
- ✅ Password matches exactly what's shown in Supabase
- ✅ Uses `postgresql://` (not `postgres://`)

### Step 3: Verify the Connection String Format

Your complete connection string should be:
```
DATABASE_URL=postgresql://postgres.zosvdbzroydrwwlwlzvi:PASSWORD@aws-1-ca-central-1.pooler.supabase.com:5432/postgres
```

**Key parts:**
- Protocol: `postgresql://`
- Username: `postgres.zosvdbzroydrwwlwlzvi` (note the `.zosvdbzroydrwwlwlzvi` part)
- Password: Your actual password (no brackets, no spaces)
- Host: `aws-1-ca-central-1.pooler.supabase.com`
- Port: `5432`
- Database: `/postgres`

### Step 4: Test Again

```bash
npx prisma db pull
```

If it still fails, double-check:
- Password matches exactly (case-sensitive!)
- No hidden characters or spaces
- Password hasn't been reset recently (if so, use the new password)

## Common Password Mistakes

- ❌ Including brackets: `[password]` → ✅ Should be: `password`
- ❌ Extra spaces: ` password ` → ✅ Should be: `password`
- ❌ Wrong password (from old screenshot/memory) → ✅ Get fresh from Supabase dashboard
- ❌ Password changed but .env not updated → ✅ Always use the latest password from dashboard

