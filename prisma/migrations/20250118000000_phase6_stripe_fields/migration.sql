-- AlterTable: Add stripeCustomerId and paidAt to EscrowTransaction
ALTER TABLE "EscrowTransaction" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "EscrowTransaction" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

