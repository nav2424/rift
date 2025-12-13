-- AlterEnum: Add new EscrowStatus values
ALTER TYPE "EscrowStatus" ADD VALUE 'DRAFT';
ALTER TYPE "EscrowStatus" ADD VALUE 'FUNDED';
ALTER TYPE "EscrowStatus" ADD VALUE 'PROOF_SUBMITTED';
ALTER TYPE "EscrowStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "EscrowStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "EscrowStatus" ADD VALUE 'PAYOUT_SCHEDULED';
ALTER TYPE "EscrowStatus" ADD VALUE 'PAID_OUT';
ALTER TYPE "EscrowStatus" ADD VALUE 'CANCELED';

-- AlterEnum: Add new DisputeStatus values
ALTER TYPE "DisputeStatus" ADD VALUE 'UNDER_REVIEW';

-- CreateEnum: DisputeResolution
CREATE TYPE "DisputeResolution" AS ENUM ('FULL_RELEASE', 'PARTIAL_REFUND', 'FULL_REFUND');

-- CreateEnum: RiskTier
CREATE TYPE "RiskTier" AS ENUM ('TIER0_NEW', 'TIER1_NORMAL', 'TIER2_TRUSTED', 'TIER3_PRO');

-- CreateEnum: WalletLedgerType
CREATE TYPE "WalletLedgerType" AS ENUM ('CREDIT_RELEASE', 'DEBIT_WITHDRAWAL', 'DEBIT_CHARGEBACK', 'DEBIT_REFUND', 'ADJUSTMENT');

-- CreateEnum: ProofType
CREATE TYPE "ProofType" AS ENUM ('PHYSICAL', 'SERVICE', 'DIGITAL');

-- CreateEnum: ProofStatus
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'VALID', 'REJECTED');

-- CreateEnum: PayoutStatus
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable: Add new fields to User
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "stripeConnectAccountId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeIdentityVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add new fields to EscrowTransaction
ALTER TABLE "EscrowTransaction" ADD COLUMN "subtotal" DOUBLE PRECISION;
ALTER TABLE "EscrowTransaction" ADD COLUMN "buyerFee" DOUBLE PRECISION;
ALTER TABLE "EscrowTransaction" ADD COLUMN "sellerFee" DOUBLE PRECISION;
ALTER TABLE "EscrowTransaction" ADD COLUMN "sellerNet" DOUBLE PRECISION;
ALTER TABLE "EscrowTransaction" ADD COLUMN "stripeChargeId" TEXT;
ALTER TABLE "EscrowTransaction" ADD COLUMN "autoReleaseAt" TIMESTAMP(3);
ALTER TABLE "EscrowTransaction" ADD COLUMN "proofSubmittedAt" TIMESTAMP(3);
ALTER TABLE "EscrowTransaction" ADD COLUMN "fundedAt" TIMESTAMP(3);
ALTER TABLE "EscrowTransaction" ADD COLUMN "releasedAt" TIMESTAMP(3);
ALTER TABLE "EscrowTransaction" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- Update existing EscrowTransaction records to set subtotal = amount
UPDATE "EscrowTransaction" SET "subtotal" = "amount" WHERE "subtotal" IS NULL;
UPDATE "EscrowTransaction" SET "buyerFee" = 0 WHERE "buyerFee" IS NULL;
UPDATE "EscrowTransaction" SET "sellerFee" = COALESCE("platformFee", 0) WHERE "sellerFee" IS NULL;
UPDATE "EscrowTransaction" SET "sellerNet" = COALESCE("sellerPayoutAmount", 0) WHERE "sellerNet" IS NULL;

-- Make subtotal, buyerFee, sellerFee NOT NULL after setting defaults
ALTER TABLE "EscrowTransaction" ALTER COLUMN "subtotal" SET NOT NULL;
ALTER TABLE "EscrowTransaction" ALTER COLUMN "buyerFee" SET NOT NULL;
ALTER TABLE "EscrowTransaction" ALTER COLUMN "sellerFee" SET NOT NULL;

-- AlterTable: Update Dispute
ALTER TABLE "Dispute" ADD COLUMN "resolution" "DisputeResolution";
ALTER TABLE "Dispute" ADD COLUMN "evidence" JSONB;
ALTER TABLE "Dispute" RENAME COLUMN "adminNote" TO "adminNotes";
ALTER TABLE "Dispute" ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- CreateTable: WalletAccount
CREATE TABLE "WalletAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WalletLedgerEntry
CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletAccountId" TEXT NOT NULL,
    "type" "WalletLedgerType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "relatedRiftId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Proof
CREATE TABLE "Proof" (
    "id" TEXT NOT NULL,
    "riftId" TEXT NOT NULL,
    "proofType" "ProofType" NOT NULL,
    "proofPayload" JSONB NOT NULL,
    "uploadedFiles" TEXT[],
    "status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Payout
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riftId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "stripePayoutId" TEXT,
    "stripeTransferId" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserRiskProfile
CREATE TABLE "UserRiskProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "RiskTier" NOT NULL DEFAULT 'TIER0_NEW',
    "completedRifts" INTEGER NOT NULL DEFAULT 0,
    "accountAgeDays" INTEGER NOT NULL DEFAULT 0,
    "chargebacksLast60Days" INTEGER NOT NULL DEFAULT 0,
    "disputesLast60Days" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastChargebackAt" TIMESTAMP(3),
    "lastDisputeAt" TIMESTAMP(3),
    "tier3Approved" BOOLEAN NOT NULL DEFAULT false,
    "tier3ApprovedAt" TIMESTAMP(3),
    "tier3ApprovedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRiskProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserBlock
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletAccount_userId_key" ON "WalletAccount"("userId");

-- CreateIndex
CREATE INDEX "WalletAccount_userId_idx" ON "WalletAccount"("userId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_walletAccountId_createdAt_idx" ON "WalletLedgerEntry"("walletAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_relatedRiftId_idx" ON "WalletLedgerEntry"("relatedRiftId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_createdAt_idx" ON "WalletLedgerEntry"("createdAt");

-- CreateIndex
CREATE INDEX "Proof_riftId_idx" ON "Proof"("riftId");

-- CreateIndex
CREATE INDEX "Proof_status_idx" ON "Proof"("status");

-- CreateIndex
CREATE INDEX "Payout_userId_idx" ON "Payout"("userId");

-- CreateIndex
CREATE INDEX "Payout_riftId_idx" ON "Payout"("riftId");

-- CreateIndex
CREATE INDEX "Payout_status_scheduledAt_idx" ON "Payout"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserRiskProfile_userId_key" ON "UserRiskProfile"("userId");

-- CreateIndex
CREATE INDEX "UserRiskProfile_userId_idx" ON "UserRiskProfile"("userId");

-- CreateIndex
CREATE INDEX "UserRiskProfile_tier_idx" ON "UserRiskProfile"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_userId_blockedById_key" ON "UserBlock"("userId", "blockedById");

-- CreateIndex
CREATE INDEX "UserBlock_userId_idx" ON "UserBlock"("userId");

-- AddForeignKey
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_walletAccountId_fkey" FOREIGN KEY ("walletAccountId") REFERENCES "WalletAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_riftId_fkey" FOREIGN KEY ("riftId") REFERENCES "EscrowTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_riftId_fkey" FOREIGN KEY ("riftId") REFERENCES "EscrowTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRiskProfile" ADD CONSTRAINT "UserRiskProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
