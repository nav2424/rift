-- AlterTable
-- Check if column exists before adding (PostgreSQL doesn't support IF NOT EXISTS for ADD COLUMN)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'EscrowTransaction' 
        AND column_name = 'requiresManualReview'
    ) THEN
        ALTER TABLE "EscrowTransaction" ADD COLUMN "requiresManualReview" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

