# How to Find Connection Pooling Connection String in Supabase

## Where You Are Now

You're on: **Database → Settings** page

## Where to Find Connection Strings

The connection strings are typically shown in one of these locations:

### Option 1: Scroll Down on Current Page

On the Database Settings page, scroll down past the "Connection pooling configuration" section. You should see:

- **Connection string** section (for direct connection)
- **Connection pooling** section with tabs like:
  - **URI** (this is what you want!)
  - **JDBC**
  - **Python**
  - **etc.**

### Option 2: Check Connection Info Section

Sometimes the connection strings are in a separate section. Look for:
- "Connection info"
- "Connection parameters"
- Or a separate tab/section showing connection details

### Option 3: Use the "Connect" Button

1. Look at the top of your Supabase dashboard
2. Click the **"Connect"** button (near the project name)
3. This usually opens a modal with connection strings including pooled connections

## What to Look For

You want the **Connection Pooling → URI → Session mode** connection string.

It should look like:
```
postgresql://postgres.zosvdbzroydrwwlwlzvi:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Key characteristics:**
- Starts with `postgresql://`
- Has `postgres.zosvdbzroydrwwlwlzvi` (project ref in username)
- Goes to `pooler.supabase.com` (not `db.PROJECT.supabase.co`)
- Port `6543` (not `5432`)

## If You Can't Find It

Alternative: Check the "Connection string" section (direct connection) - it should be visible somewhere on the same page. You can also:

1. Click "Reset database password" if you want to verify/change the password
2. The connection strings usually update automatically when password changes

## After You Find It

1. Copy the entire connection string
2. Update your `.env` file:
   ```
   DATABASE_URL=postgresql://postgres.zosvdbzroydrwwlwlzvi:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
3. Test: `npx prisma db pull`

