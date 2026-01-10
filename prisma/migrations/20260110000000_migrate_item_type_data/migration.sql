-- Migrate old ItemType enum values to new ones
-- This updates existing data to use the new enum values that match the Prisma schema

-- Update TICKETS -> OWNERSHIP_TRANSFER
UPDATE "EscrowTransaction"
SET "itemType" = 'OWNERSHIP_TRANSFER'::"ItemType"
WHERE "itemType" = 'TICKETS'::"ItemType";

-- Update DIGITAL -> DIGITAL_GOODS  
UPDATE "EscrowTransaction"
SET "itemType" = 'DIGITAL_GOODS'::"ItemType"
WHERE "itemType" = 'DIGITAL'::"ItemType";

-- Note: We keep the old enum values in the database for now to avoid breaking
-- any code that might still reference them. They can be removed later after
-- verifying all data has been migrated.
