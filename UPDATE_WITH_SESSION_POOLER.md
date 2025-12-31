# Update DATABASE_URL with Session Pooler Connection String

## Connection String You Found

```
postgresql://postgres.zosvdbzroydrwwlwlzvi:[YOUR-PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:5432/postgres
```

## Steps to Update

### Step 1: Get Your Database Password

1. In the Supabase modal, scroll down to find "Reset your database password" section
2. OR go back to Database Settings → "Database password" section
3. Click "Reveal" or "Show" next to the database password
4. Copy the password

### Step 2: Replace [YOUR-PASSWORD] in the Connection String

Take the connection string from the modal:
```
postgresql://postgres.zosvdbzroydrwwlwlzvi:[YOUR-PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:5432/postgres
```

Replace `[YOUR-PASSWORD]` with your actual password (no brackets).

**Example:**
If your password is `mypassword123`, it becomes:
```
postgresql://postgres.zosvdbzroydrwwlwlzvi:mypassword123@aws-1-ca-central-1.pooler.supabase.com:5432/postgres
```

### Step 3: Update Your .env File

Open your `.env` file and replace the `DATABASE_URL` line:

**Before:**
```
DATABASE_URL=postgresql://postgres:i1eTjEwbrXB3rvsL@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres
```

**After (with your actual password):**
```
DATABASE_URL=postgresql://postgres.zosvdbzroydrwwlwlzvi:YOUR_ACTUAL_PASSWORD@aws-1-ca-central-1.pooler.supabase.com:5432/postgres
```

**Important:**
- Make sure there are NO brackets `[]` around the password
- Make sure there are NO spaces
- The password should match exactly what's shown in Supabase

### Step 4: Test the Connection

```bash
npx prisma db pull
```

This should now work! ✅

## Key Differences from Your Old Connection String

| Old (Direct) | New (Session Pooler) |
|--------------|---------------------|
| `postgres@db.zosvdbzroydrwwlwlzvi.supabase.co` | `postgres.zosvdbzroydrwwlwlzvi@aws-1-ca-central-1.pooler.supabase.com` |
| Port: 5432 | Port: 5432 (same) |
| Direct connection | Goes through pooler (more reliable) |

## Why Session Pooler?

- ✅ IPv4 compatible (works everywhere)
- ✅ More reliable connections
- ✅ Better for serverless applications
- ✅ Recommended for most use cases

