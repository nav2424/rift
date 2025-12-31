-- AlterEnum: Add new EscrowStatus values (only if they don't exist)
DO $$ 
DECLARE
    enum_type_oid OID;
BEGIN
    -- Check if EscrowStatus enum exists
    SELECT oid INTO enum_type_oid FROM pg_type WHERE typname = 'EscrowStatus';
    
    -- Only proceed if the enum exists
    IF enum_type_oid IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DRAFT' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "EscrowStatus" ADD VALUE 'DRAFT';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FUNDED' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "EscrowStatus" ADD VALUE 'FUNDED';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAID' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "EscrowStatus" ADD VALUE 'PAID';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROOF_SUBMITTED' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "EscrowStatus" ADD VALUE 'PROOF_SUBMITTED';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'UNDER_REVIEW' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "EscrowStatus" ADD VALUE 'UNDER_REVIEW';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RESOLVED' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "EscrowStatus" ADD VALUE 'RESOLVED';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAYOUT_SCHEDULED' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "EscrowStatus" ADD VALUE 'PAYOUT_SCHEDULED';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAID_OUT' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "EscrowStatus" ADD VALUE 'PAID_OUT';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CANCELED' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "EscrowStatus" ADD VALUE 'CANCELED';
        END IF;
    END IF;
END $$;

-- AlterEnum: Add new DisputeStatus values (only if it doesn't exist)
DO $$ 
DECLARE
    enum_type_oid OID;
BEGIN
    -- Check if DisputeStatus enum exists
    SELECT oid INTO enum_type_oid FROM pg_type WHERE typname = 'DisputeStatus';
    
    -- Only proceed if the enum exists
    IF enum_type_oid IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'UNDER_REVIEW' AND enumtypid = enum_type_oid) THEN
            ALTER TYPE "DisputeStatus" ADD VALUE 'UNDER_REVIEW';
        END IF;
    END IF;
END $$;

-- CreateEnum: DisputeResolution (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeResolution') THEN
        CREATE TYPE "DisputeResolution" AS ENUM ('FULL_RELEASE', 'PARTIAL_REFUND', 'FULL_REFUND');
    END IF;
END $$;

-- CreateEnum: RiskTier (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskTier') THEN
        CREATE TYPE "RiskTier" AS ENUM ('TIER0_NEW', 'TIER1_NORMAL', 'TIER2_TRUSTED', 'TIER3_PRO');
    END IF;
END $$;

-- CreateEnum: WalletLedgerType (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletLedgerType') THEN
        CREATE TYPE "WalletLedgerType" AS ENUM ('CREDIT_RELEASE', 'DEBIT_WITHDRAWAL', 'DEBIT_CHARGEBACK', 'DEBIT_REFUND', 'ADJUSTMENT');
    END IF;
END $$;

-- CreateEnum: ProofType (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProofType') THEN
        CREATE TYPE "ProofType" AS ENUM ('PHYSICAL', 'SERVICE', 'DIGITAL');
    END IF;
END $$;

-- CreateEnum: ProofStatus (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProofStatus') THEN
        CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'VALID', 'REJECTED');
    END IF;
END $$;

-- CreateEnum: PayoutStatus (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayoutStatus') THEN
        CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED');
    END IF;
END $$;

-- AlterTable: Add new fields to User (only if they don't exist)
DO $$ 
BEGIN
    -- Check if User table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'emailVerified') THEN
            ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'phoneVerified') THEN
            ALTER TABLE "User" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'stripeConnectAccountId') THEN
            ALTER TABLE "User" ADD COLUMN "stripeConnectAccountId" TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'stripeIdentityVerified') THEN
            ALTER TABLE "User" ADD COLUMN "stripeIdentityVerified" BOOLEAN NOT NULL DEFAULT false;
        END IF;
    END IF;
END $$;

-- AlterTable: Add new fields to EscrowTransaction (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'EscrowTransaction') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'subtotal') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "subtotal" DOUBLE PRECISION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'buyerFee') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "buyerFee" DOUBLE PRECISION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'sellerFee') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "sellerFee" DOUBLE PRECISION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'sellerNet') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "sellerNet" DOUBLE PRECISION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'stripeChargeId') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "stripeChargeId" TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'autoReleaseAt') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "autoReleaseAt" TIMESTAMP(3);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'proofSubmittedAt') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "proofSubmittedAt" TIMESTAMP(3);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'fundedAt') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "fundedAt" TIMESTAMP(3);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'releasedAt') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "releasedAt" TIMESTAMP(3);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'version') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
        END IF;
        
        -- Update existing EscrowTransaction records to set subtotal = amount
        UPDATE "EscrowTransaction" SET "subtotal" = "amount" WHERE "subtotal" IS NULL;
        UPDATE "EscrowTransaction" SET "buyerFee" = 0 WHERE "buyerFee" IS NULL;
        UPDATE "EscrowTransaction" SET "sellerFee" = COALESCE("platformFee", 0) WHERE "sellerFee" IS NULL;
        UPDATE "EscrowTransaction" SET "sellerNet" = COALESCE("sellerPayoutAmount", 0) WHERE "sellerNet" IS NULL;
        
        -- Make subtotal, buyerFee, sellerFee NOT NULL after setting defaults (only if columns exist and are nullable)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'subtotal' AND is_nullable = 'YES') THEN
            ALTER TABLE "EscrowTransaction" ALTER COLUMN "subtotal" SET NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'buyerFee' AND is_nullable = 'YES') THEN
            ALTER TABLE "EscrowTransaction" ALTER COLUMN "buyerFee" SET NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EscrowTransaction' AND column_name = 'sellerFee' AND is_nullable = 'YES') THEN
            ALTER TABLE "EscrowTransaction" ALTER COLUMN "sellerFee" SET NOT NULL;
        END IF;
    END IF;
END $$;

-- AlterTable: Update Dispute (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Dispute') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Dispute' AND column_name = 'resolution') THEN
            ALTER TABLE "Dispute" ADD COLUMN "resolution" "DisputeResolution";
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Dispute' AND column_name = 'evidence') THEN
            ALTER TABLE "Dispute" ADD COLUMN "evidence" JSONB;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Dispute' AND column_name = 'adminNote') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Dispute' AND column_name = 'adminNotes') THEN
            ALTER TABLE "Dispute" RENAME COLUMN "adminNote" TO "adminNotes";
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Dispute' AND column_name = 'resolvedAt') THEN
            ALTER TABLE "Dispute" ADD COLUMN "resolvedAt" TIMESTAMP(3);
        END IF;
    END IF;
END $$;

-- CreateTable: WalletAccount (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "WalletAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WalletLedgerEntry (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "WalletLedgerEntry" (
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

-- CreateTable: Proof (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "Proof" (
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

-- CreateTable: Payout (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "Payout" (
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

-- CreateTable: UserRiskProfile (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "UserRiskProfile" (
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

-- CreateTable: UserBlock (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "UserBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if they don't exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'WalletAccount') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'WalletAccount_userId_key') THEN
            CREATE UNIQUE INDEX "WalletAccount_userId_key" ON "WalletAccount"("userId");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'WalletAccount_userId_idx') THEN
            CREATE INDEX "WalletAccount_userId_idx" ON "WalletAccount"("userId");
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'WalletLedgerEntry') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'WalletLedgerEntry_walletAccountId_createdAt_idx') THEN
            CREATE INDEX "WalletLedgerEntry_walletAccountId_createdAt_idx" ON "WalletLedgerEntry"("walletAccountId", "createdAt");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'WalletLedgerEntry_relatedRiftId_idx') THEN
            CREATE INDEX "WalletLedgerEntry_relatedRiftId_idx" ON "WalletLedgerEntry"("relatedRiftId");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'WalletLedgerEntry_createdAt_idx') THEN
            CREATE INDEX "WalletLedgerEntry_createdAt_idx" ON "WalletLedgerEntry"("createdAt");
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Proof') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Proof_riftId_idx') THEN
            CREATE INDEX "Proof_riftId_idx" ON "Proof"("riftId");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Proof_status_idx') THEN
            CREATE INDEX "Proof_status_idx" ON "Proof"("status");
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Payout') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Payout_userId_idx') THEN
            CREATE INDEX "Payout_userId_idx" ON "Payout"("userId");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Payout_riftId_idx') THEN
            CREATE INDEX "Payout_riftId_idx" ON "Payout"("riftId");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Payout_status_scheduledAt_idx') THEN
            CREATE INDEX "Payout_status_scheduledAt_idx" ON "Payout"("status", "scheduledAt");
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'UserRiskProfile') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'UserRiskProfile_userId_key') THEN
            CREATE UNIQUE INDEX "UserRiskProfile_userId_key" ON "UserRiskProfile"("userId");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'UserRiskProfile_userId_idx') THEN
            CREATE INDEX "UserRiskProfile_userId_idx" ON "UserRiskProfile"("userId");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'UserRiskProfile_tier_idx') THEN
            CREATE INDEX "UserRiskProfile_tier_idx" ON "UserRiskProfile"("tier");
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'UserBlock') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'UserBlock_userId_blockedById_key') THEN
            CREATE UNIQUE INDEX "UserBlock_userId_blockedById_key" ON "UserBlock"("userId", "blockedById");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'UserBlock_userId_idx') THEN
            CREATE INDEX "UserBlock_userId_idx" ON "UserBlock"("userId");
        END IF;
    END IF;
END $$;

-- AddForeignKey (only if they don't exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'WalletAccount')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'WalletAccount_userId_fkey') THEN
        -- Clean up orphaned records before adding constraint
        DELETE FROM "WalletAccount" 
        WHERE "userId" NOT IN (SELECT "id" FROM "User");
        
        -- Now add the foreign key constraint
        ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'WalletLedgerEntry')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'WalletAccount')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'WalletLedgerEntry_walletAccountId_fkey') THEN
        -- Clean up orphaned records before adding constraint
        DELETE FROM "WalletLedgerEntry" 
        WHERE "walletAccountId" NOT IN (SELECT "id" FROM "WalletAccount");
        
        -- Now add the foreign key constraint
        ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_walletAccountId_fkey" FOREIGN KEY ("walletAccountId") REFERENCES "WalletAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Proof')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'EscrowTransaction')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'Proof_riftId_fkey') THEN
        -- Clean up orphaned records before adding constraint
        DELETE FROM "Proof" 
        WHERE "riftId" NOT IN (SELECT "id" FROM "EscrowTransaction");
        
        -- Now add the foreign key constraint
        ALTER TABLE "Proof" ADD CONSTRAINT "Proof_riftId_fkey" FOREIGN KEY ("riftId") REFERENCES "EscrowTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Payout')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'Payout_userId_fkey') THEN
        -- Clean up orphaned records before adding constraint
        DELETE FROM "Payout" 
        WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT "id" FROM "User");
        
        -- Now add the foreign key constraint
        ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Payout')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'EscrowTransaction')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'Payout_riftId_fkey') THEN
        -- Clean up orphaned records before adding constraint (riftId can be NULL, so only delete non-null orphans)
        DELETE FROM "Payout" 
        WHERE "riftId" IS NOT NULL AND "riftId" NOT IN (SELECT "id" FROM "EscrowTransaction");
        
        -- Now add the foreign key constraint
        ALTER TABLE "Payout" ADD CONSTRAINT "Payout_riftId_fkey" FOREIGN KEY ("riftId") REFERENCES "EscrowTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'UserRiskProfile')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'UserRiskProfile_userId_fkey') THEN
        -- Clean up orphaned records before adding constraint
        DELETE FROM "UserRiskProfile" 
        WHERE "userId" NOT IN (SELECT "id" FROM "User");
        
        -- Now add the foreign key constraint
        ALTER TABLE "UserRiskProfile" ADD CONSTRAINT "UserRiskProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'UserBlock')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'UserBlock_userId_fkey') THEN
        -- Clean up orphaned records before adding constraint
        DELETE FROM "UserBlock" 
        WHERE "userId" NOT IN (SELECT "id" FROM "User");
        
        -- Now add the foreign key constraint
        ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'UserBlock')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'UserBlock_blockedById_fkey') THEN
        -- Clean up orphaned records before adding constraint
        DELETE FROM "UserBlock" 
        WHERE "blockedById" NOT IN (SELECT "id" FROM "User");
        
        -- Now add the foreign key constraint
        ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
