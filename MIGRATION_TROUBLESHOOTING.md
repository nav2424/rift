# Migration Troubleshooting Guide

## Error: "type EscrowStatus does not exist"

This error occurs when the migration tries to add enum values to `EscrowStatus` but the enum type itself doesn't exist in the database.

### Solution 1: Ensure Baseline Migration is Applied

The `EscrowStatus` enum should be created by the baseline migration (`20251211220841_baseline_postgresql`). 

**Check migration status:**
```bash
npx prisma migrate status
```

**If baseline is not applied, apply it first:**
```bash
npx prisma migrate deploy
```

### Solution 2: Verify Database State

Run the verification script to check what exists in your database:
```bash
psql $DATABASE_URL -f scripts/verify-migration.sql
```

### Solution 3: Manual Fix

If the enum doesn't exist, you need to create it first. The baseline migration should have done this, but if it's missing, you can manually create it:

```sql
-- Only run this if EscrowStatus doesn't exist
CREATE TYPE "EscrowStatus" AS ENUM (
  'AWAITING_PAYMENT', 
  'AWAITING_SHIPMENT', 
  'IN_TRANSIT', 
  'DELIVERED_PENDING_RELEASE', 
  'RELEASED', 
  'REFUNDED', 
  'DISPUTED', 
  'CANCELLED'
);
```

Then run the new migration again.

### Solution 4: Reset and Reapply (Development Only)

⚠️ **WARNING: This will delete all data!**

If you're in development and can reset the database:

```bash
npx prisma migrate reset
```

This will:
1. Drop the database
2. Create a new database
3. Apply all migrations from scratch

### Current Migration Status

The migration file `20251212163608_add_rift_business_model/migration.sql` has been updated to:
- Check if enum types exist before trying to add values
- Handle cases where the baseline migration hasn't been applied
- Be idempotent (safe to run multiple times)

### Next Steps

1. **Check your migration status:**
   ```bash
   npx prisma migrate status
   ```

2. **If migrations are out of sync, check what's in the database:**
   ```bash
   psql $DATABASE_URL -c "SELECT typname FROM pg_type WHERE typname LIKE '%Status%' OR typname LIKE '%Type%';"
   ```

3. **Apply migrations:**
   ```bash
   npx prisma migrate deploy
   ```

4. **If errors persist, check the Prisma migration history:**
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
   ```
