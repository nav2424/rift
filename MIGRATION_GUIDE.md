# Migration Guide: Launch Scope Updates

## Migration File
`prisma/migrations/20250123000000_launch_scope_updates/migration.sql`

## Changes

### 1. Add LICENSE_KEYS to ItemType Enum
- Adds `LICENSE_KEYS` as a new item type
- Safe: Uses `DO $$` block to check if value already exists

### 2. Create daily_roots Table
- New table for tamper-evident audit trail
- Stores daily root hashes with server signatures
- Enables cross-day chain verification

### 3. Add Canonical Hashing Fields to VaultAsset
- `canonicalSha256`: Normalized content hash
- `perceptualHash`: Perceptual hash (pHash) for images
- `averageHash`: Average hash (aHash) for fast similarity
- All fields are nullable (backward compatible)

## Running the Migration

### Development
```bash
# If migrate dev fails with shadow database errors, use deploy instead:
npx prisma migrate deploy
```

### Production
```bash
# Review migration first
npx prisma migrate status

# Apply migration
npx prisma migrate deploy
```

**Note:** If you encounter shadow database errors with `migrate dev`, use `migrate deploy` instead. The deploy command applies migrations directly to your database without needing a shadow database.

## Verification

After migration, verify:

1. **ItemType enum:**
```sql
SELECT unnest(enum_range(NULL::"ItemType"));
-- Should include: DIGITAL, TICKETS, SERVICES, LICENSE_KEYS, PHYSICAL
```

2. **daily_roots table:**
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'daily_roots';
-- Should return 1 row
```

3. **VaultAsset columns:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'vault_assets' 
AND column_name IN ('canonicalSha256', 'perceptualHash', 'averageHash');
-- Should return 3 rows
```

## Rollback

If needed, rollback steps:

```sql
-- Remove columns (if migration applied)
ALTER TABLE "vault_assets" DROP COLUMN IF EXISTS "canonicalSha256";
ALTER TABLE "vault_assets" DROP COLUMN IF EXISTS "perceptualHash";
ALTER TABLE "vault_assets" DROP COLUMN IF EXISTS "averageHash";

-- Drop table
DROP TABLE IF EXISTS "daily_roots";

-- Note: Cannot remove enum value in PostgreSQL, but can mark as deprecated
```

## Post-Migration Tasks

1. **Generate Prisma Client:**
```bash
npx prisma generate
```

2. **Update Application Code:**
- Code already updated to use new fields
- No additional changes needed

3. **Backfill Canonical Hashes (Optional):**
- Run script to compute canonical hashes for existing assets
- See `scripts/backfill-canonical-hashes.ts` (to be created)

## Environment Variables

For daily root signing, add to `.env`:

```bash
# RSA key pair for signing daily roots
AUDIT_CHAIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
AUDIT_CHAIN_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

Generate keys:
```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

---

**Status:** ✅ Migration ready  
**Last Updated:** 2025-01-22
