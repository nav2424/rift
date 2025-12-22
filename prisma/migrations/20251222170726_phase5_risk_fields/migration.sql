-- AlterTable
-- Note: If you get an error that "EscrowTransaction" doesn't exist, 
-- run the query in supabase/migrations/000_check_table_names.sql to find the correct table name
-- Then replace "EscrowTransaction" with the actual table name below

-- Try with EscrowTransaction first (Prisma maps RiftTransaction model to EscrowTransaction table)
ALTER TABLE "EscrowTransaction" ADD COLUMN IF NOT EXISTS "requiresBuyerConfirmation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EscrowTransaction" ADD COLUMN IF NOT EXISTS "requiresManualReview" BOOLEAN NOT NULL DEFAULT false;

-- If the above fails, the table might be named differently. Common alternatives:
-- ALTER TABLE "RiftTransaction" ADD COLUMN IF NOT EXISTS "requiresBuyerConfirmation" BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE "rift_transactions" ADD COLUMN IF NOT EXISTS "requiresBuyerConfirmation" BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "requiresBuyerConfirmation" BOOLEAN NOT NULL DEFAULT false;

