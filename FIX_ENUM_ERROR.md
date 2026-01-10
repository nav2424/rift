# Fix: ItemType Enum Error - "Value 'TICKETS' not found in enum 'ItemType'"

## Problem

The database contains old enum values (`TICKETS`, `DIGITAL`, `LICENSE_KEYS`) that don't exist in the Prisma schema. When Prisma tries to read records with these values, it fails with:

```
Value 'TICKETS' not found in enum 'ItemType'
```

## Root Cause

The database was created with enum values: `PHYSICAL`, `DIGITAL`, `TICKETS`, `SERVICES`

But the Prisma schema now expects: `PHYSICAL`, `DIGITAL_GOODS`, `OWNERSHIP_TRANSFER`, `SERVICES`

Old data in the database still uses `TICKETS` and `DIGITAL`, causing Prisma to fail during deserialization.

## Solution: Migrate Database Data

Run the migration script to update all existing records to use the new enum values:

### Option 1: Using the Migration Script (Recommended)

```bash
# Make sure DATABASE_URL is set to your production database
export DATABASE_URL="postgresql://postgres:PASSWORD@db.zosvdbzroydrwwlwlzvi.supabase.co:5432/postgres"

# Or pull from Vercel
vercel env pull .env.production
source .env.production

# Run the migration script
npx tsx scripts/migrate-item-type-enum.ts
```

This script will:
1. Check which records need migration
2. Ensure new enum values exist in the database
3. Migrate all records:
   - `TICKETS` → `OWNERSHIP_TRANSFER`
   - `DIGITAL` → `DIGITAL_GOODS`
   - `LICENSE_KEYS` → `DIGITAL_GOODS`

### Option 2: Using SQL Migration File

Run the SQL migration directly in Supabase:

1. Go to: https://supabase.com/dashboard/project/zosvdbzroydrwwlwlzvi/sql/new
2. Paste and run:

```sql
-- Ensure new enum values exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'OWNERSHIP_TRANSFER' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ItemType')
  ) THEN
    ALTER TYPE "ItemType" ADD VALUE 'OWNERSHIP_TRANSFER';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'DIGITAL_GOODS' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ItemType')
  ) THEN
    ALTER TYPE "ItemType" ADD VALUE 'DIGITAL_GOODS';
  END IF;
END $$;

-- Migrate existing data
UPDATE "EscrowTransaction"
SET "itemType" = 'OWNERSHIP_TRANSFER'::"ItemType"
WHERE "itemType"::text = 'TICKETS';

UPDATE "EscrowTransaction"
SET "itemType" = 'DIGITAL_GOODS'::"ItemType"
WHERE "itemType"::text = 'DIGITAL';

UPDATE "EscrowTransaction"
SET "itemType" = 'DIGITAL_GOODS'::"ItemType"
WHERE "itemType"::text = 'LICENSE_KEYS';
```

3. Click "Run"

### Option 3: Manual SQL in Supabase

If you prefer to run it manually:

```sql
-- Check current enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ItemType') 
ORDER BY enumsortorder;

-- Check records with old values
SELECT COUNT(*) FROM "EscrowTransaction" WHERE "itemType"::text = 'TICKETS';
SELECT COUNT(*) FROM "EscrowTransaction" WHERE "itemType"::text = 'DIGITAL';

-- Add new enum values (if not already added)
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'OWNERSHIP_TRANSFER';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'DIGITAL_GOODS';

-- Migrate data
UPDATE "EscrowTransaction" SET "itemType" = 'OWNERSHIP_TRANSFER'::"ItemType" WHERE "itemType"::text = 'TICKETS';
UPDATE "EscrowTransaction" SET "itemType" = 'DIGITAL_GOODS'::"ItemType" WHERE "itemType"::text = 'DIGITAL';
UPDATE "EscrowTransaction" SET "itemType" = 'DIGITAL_GOODS'::"ItemType" WHERE "itemType"::text = 'LICENSE_KEYS';
```

## After Migration

1. **Regenerate Prisma Client:**
   ```bash
   npx prisma generate
   ```

2. **Verify the migration:**
   ```bash
   npx tsx scripts/migrate-item-type-enum.ts
   ```
   Should show "No records need migration"

3. **Test the application:**
   - The enum error should be resolved
   - All queries should work without raw SQL fallback

## Temporary Workaround

The code already has a fallback that uses raw SQL when enum errors occur. This allows the app to work even before the migration is applied. However, it's better to migrate the data for optimal performance.

## Verification Queries

After migration, verify with:

```sql
-- Should return 0 for old values
SELECT COUNT(*) FROM "EscrowTransaction" WHERE "itemType"::text = 'TICKETS';
SELECT COUNT(*) FROM "EscrowTransaction" WHERE "itemType"::text = 'DIGITAL';

-- Should show new values
SELECT "itemType"::text, COUNT(*) 
FROM "EscrowTransaction" 
GROUP BY "itemType"::text;
```
