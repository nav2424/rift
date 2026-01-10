# How to Apply the Archive Fields Migration

The migration adds `buyerArchived`, `sellerArchived`, `buyerArchivedAt`, and `sellerArchivedAt` columns to the `EscrowTransaction` table.

## Option 1: Using Prisma Migrate (Recommended)

This is the safest method and will properly track the migration.

### For Production Database:

1. **Pull production environment variables from Vercel:**
   ```bash
   # Install Vercel CLI if not already installed
   npm i -g vercel
   
   # Login to Vercel
   vercel login
   
   # Link your project (if not already linked)
   vercel link
   
   # Pull production environment variables
   vercel env pull .env.production
   ```

2. **Set the DATABASE_URL and run migrations:**
   ```bash
   # Load the production DATABASE_URL from .env.production
   export $(cat .env.production | grep DATABASE_URL | xargs)
   
   # Or manually set it:
   # export DATABASE_URL="postgresql://postgres:PASSWORD@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres"
   
   # Apply all pending migrations
   npx prisma migrate deploy
   ```

   This will:
   - Connect to your production database
   - Apply only migrations that haven't been applied yet
   - Mark the migration as applied in Prisma's migration tracking table

---

## Option 2: Manual SQL via Supabase Dashboard (Quick Method)

If you prefer to apply it manually through the Supabase UI:

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard
   - Select your project (likely `zosvdbzroydrwwlwlzvi`)

2. **Open SQL Editor:**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Run the migration SQL:**
   ```sql
   -- Add archive columns to EscrowTransaction table
   ALTER TABLE "EscrowTransaction" 
   ADD COLUMN IF NOT EXISTS "buyerArchived" BOOLEAN NOT NULL DEFAULT false,
   ADD COLUMN IF NOT EXISTS "sellerArchived" BOOLEAN NOT NULL DEFAULT false,
   ADD COLUMN IF NOT EXISTS "buyerArchivedAt" TIMESTAMP(3),
   ADD COLUMN IF NOT EXISTS "sellerArchivedAt" TIMESTAMP(3);

   -- Create indexes (only if they don't exist)
   CREATE INDEX IF NOT EXISTS "EscrowTransaction_buyerArchived_idx" 
   ON "EscrowTransaction"("buyerArchived");
   
   CREATE INDEX IF NOT EXISTS "EscrowTransaction_sellerArchived_idx" 
   ON "EscrowTransaction"("sellerArchived");
   ```

4. **Click "Run"** to execute the query

5. **Mark migration as applied (if using Prisma):**
   After manually applying, you may need to manually mark it as applied in Prisma's migration tracking:
   ```bash
   # Connect to your database and insert the migration record
   # Or use Prisma migrate resolve to mark it as applied
   npx prisma migrate resolve --applied 20260109000000_add_archive_fields
   ```

---

## Option 3: Using Vercel CLI with Production Database

If your production DATABASE_URL is already in Vercel:

1. **Pull environment variables:**
   ```bash
   vercel env pull .env.production
   ```

2. **Run migration:**
   ```bash
   # Source the production environment
   set -a && source .env.production && set +a
   
   # Or on Windows:
   # Get-Content .env.production | ForEach-Object { if($_ -match "^([^=]+)=(.*)$") { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process") } }
   
   # Apply migrations
   npx prisma migrate deploy
   ```

---

## Verify Migration Was Applied

After applying, verify the columns exist:

```bash
# Using Prisma Studio (interactive)
npx prisma studio

# Or using SQL query in Supabase
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'EscrowTransaction' 
  AND column_name IN ('buyerArchived', 'sellerArchived', 'buyerArchivedAt', 'sellerArchivedAt');
```

You should see all 4 columns in the results.

---

## Recommended Approach

**For Production:** Use **Option 1** (Prisma Migrate Deploy) as it:
- ✅ Properly tracks migrations
- ✅ Is idempotent (safe to run multiple times)
- ✅ Integrates with your existing migration workflow
- ✅ Can be automated in CI/CD

**For Quick Testing:** Use **Option 2** (Supabase SQL Editor) if you need to apply it immediately.

---

## Troubleshooting

**If migration already applied error:**
- The columns might already exist. Check with the verification query above.
- If they exist but Prisma thinks migration isn't applied, use:
  ```bash
  npx prisma migrate resolve --applied 20260109000000_add_archive_fields
  ```

**If connection error:**
- Verify your DATABASE_URL is correct
- Check that your IP is allowed in Supabase (Settings → Database → Connection Pooling)
- Try using the direct connection string instead of pooled connection

**If permission error:**
- Ensure your database user has ALTER TABLE permissions
- Check Supabase project settings for database user permissions
