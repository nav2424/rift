-- Manually add missing enum values to ItemType
-- Run this directly on the database if the migration didn't work

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

