-- Fix ItemType enum to match Prisma schema
-- Migration: 20250126000000_fix_item_type_enum
-- Note: This migration only adds enum values. Data migration should be done separately
-- after the enum values are committed.

-- Add DIGITAL_GOODS to ItemType enum
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

-- Add OWNERSHIP_TRANSFER to ItemType enum
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

