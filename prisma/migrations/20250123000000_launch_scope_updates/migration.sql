-- Launch Scope Updates: Add LICENSE_KEYS, daily_roots table, canonical hashing fields
-- Migration: 20250123000000_launch_scope_updates

-- 1. Add LICENSE_KEYS to ItemType enum
DO $$ 
BEGIN
    -- Check if LICENSE_KEYS already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'LICENSE_KEYS' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ItemType')
    ) THEN
        ALTER TYPE "ItemType" ADD VALUE 'LICENSE_KEYS';
    END IF;
END $$;

-- 2. Create daily_roots table for tamper-evident audit trail
CREATE TABLE IF NOT EXISTS "daily_roots" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL, -- YYYY-MM-DD format
    "rootHash" TEXT NOT NULL,
    "previousDayHash" TEXT,
    "signature" TEXT NOT NULL,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_roots_pkey" PRIMARY KEY ("id")
);

-- Create unique index on date
CREATE UNIQUE INDEX IF NOT EXISTS "daily_roots_date_key" ON "daily_roots"("date");

-- Create unique index on rootHash
CREATE UNIQUE INDEX IF NOT EXISTS "daily_roots_rootHash_key" ON "daily_roots"("rootHash");

-- Create index on createdAt for queries
CREATE INDEX IF NOT EXISTS "daily_roots_createdAt_idx" ON "daily_roots"("createdAt");

-- 3. Add canonical hashing fields to vault_assets table
DO $$ 
BEGIN
    -- Add canonicalSha256 column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vault_assets' 
        AND column_name = 'canonicalSha256'
    ) THEN
        ALTER TABLE "vault_assets" ADD COLUMN "canonicalSha256" TEXT;
    END IF;

    -- Add perceptualHash column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vault_assets' 
        AND column_name = 'perceptualHash'
    ) THEN
        ALTER TABLE "vault_assets" ADD COLUMN "perceptualHash" TEXT;
    END IF;

    -- Add averageHash column if it doesn't exist (for aHash)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vault_assets' 
        AND column_name = 'averageHash'
    ) THEN
        ALTER TABLE "vault_assets" ADD COLUMN "averageHash" TEXT;
    END IF;
END $$;

-- Create indexes on hash fields for duplicate detection
CREATE INDEX IF NOT EXISTS "vault_assets_canonicalSha256_idx" ON "vault_assets"("canonicalSha256");
CREATE INDEX IF NOT EXISTS "vault_assets_perceptualHash_idx" ON "vault_assets"("perceptualHash");
CREATE INDEX IF NOT EXISTS "vault_assets_averageHash_idx" ON "vault_assets"("averageHash");

-- 4. Add comment to document the changes
COMMENT ON TABLE "daily_roots" IS 'Daily root hashes for tamper-evident audit trail. Each day''s events are hashed together and signed.';
COMMENT ON COLUMN "vault_assets"."canonicalSha256" IS 'Canonical hash of normalized content (prevents "same file slightly modified" evasion)';
COMMENT ON COLUMN "vault_assets"."perceptualHash" IS 'Perceptual hash (pHash) for image similarity detection';
COMMENT ON COLUMN "vault_assets"."averageHash" IS 'Average hash (aHash) for fast image similarity detection';