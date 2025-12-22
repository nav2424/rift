-- AlterTable
ALTER TABLE "EscrowTransaction" ADD COLUMN IF NOT EXISTS "requiresBuyerConfirmation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EscrowTransaction" ADD COLUMN IF NOT EXISTS "requiresManualReview" BOOLEAN NOT NULL DEFAULT false;

