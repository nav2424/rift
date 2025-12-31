-- Add Vault System: VaultAsset, VaultEvent, AdminReview
-- This migration adds the comprehensive vault system with tamper-evident logging

-- CreateEnum: VaultAssetType
DO $$ BEGIN
 CREATE TYPE "VaultAssetType" AS ENUM('FILE', 'LICENSE_KEY', 'TRACKING', 'TICKET_PROOF', 'URL', 'TEXT_INSTRUCTIONS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: VaultScanStatus
DO $$ BEGIN
 CREATE TYPE "VaultScanStatus" AS ENUM('PENDING', 'PASS', 'FAIL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: VaultEventType
DO $$ BEGIN
 CREATE TYPE "VaultEventType" AS ENUM('BUYER_OPENED_ASSET', 'BUYER_DOWNLOADED_FILE', 'BUYER_REVEALED_LICENSE_KEY', 'BUYER_VIEWED_QR', 'BUYER_VIEWED_TRACKING', 'BUYER_CLICKED_EXTERNAL_LINK', 'BUYER_TIME_IN_VIEW', 'BUYER_SCROLL_DEPTH', 'SELLER_UPLOADED_ASSET', 'SELLER_SUBMITTED_PROOF', 'ADMIN_VIEWED_ASSET', 'ADMIN_DOWNLOADED_RAW', 'ADMIN_APPROVED_PROOF', 'ADMIN_REJECTED_PROOF', 'SYSTEM_SCAN_COMPLETED', 'SYSTEM_QUALITY_CHECK_COMPLETED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: VaultActorRole
DO $$ BEGIN
 CREATE TYPE "VaultActorRole" AS ENUM('BUYER', 'SELLER', 'ADMIN', 'SYSTEM');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: AdminReviewStatus
DO $$ BEGIN
 CREATE TYPE "AdminReviewStatus" AS ENUM('OPEN', 'APPROVED', 'REJECTED', 'ESCALATED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable: VaultAsset
CREATE TABLE IF NOT EXISTS "vault_assets" (
    "id" TEXT NOT NULL,
    "riftId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "assetType" "VaultAssetType" NOT NULL,
    "storagePath" TEXT,
    "fileName" TEXT,
    "sha256" TEXT NOT NULL,
    "mimeDetected" TEXT,
    "scanStatus" "VaultScanStatus" NOT NULL DEFAULT 'PENDING',
    "qualityScore" INTEGER,
    "metadataJson" JSONB,
    "supersedesAssetId" TEXT,
    "encryptedData" TEXT,
    "url" TEXT,
    "trackingNumber" TEXT,
    "textContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VaultEvent
CREATE TABLE IF NOT EXISTS "vault_events" (
    "id" TEXT NOT NULL,
    "riftId" TEXT NOT NULL,
    "assetId" TEXT,
    "actorId" TEXT,
    "actorRole" "VaultActorRole" NOT NULL,
    "eventType" "VaultEventType" NOT NULL,
    "timestampUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "sessionId" TEXT,
    "deviceFingerprint" TEXT,
    "assetHash" TEXT,
    "prevLogHash" TEXT,
    "logHash" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "vault_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminReview
CREATE TABLE IF NOT EXISTS "admin_reviews" (
    "id" TEXT NOT NULL,
    "riftId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "AdminReviewStatus" NOT NULL DEFAULT 'OPEN',
    "reasonsJson" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "admin_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vault_assets_riftId_idx" ON "vault_assets"("riftId");
CREATE INDEX IF NOT EXISTS "vault_assets_sha256_idx" ON "vault_assets"("sha256");
CREATE INDEX IF NOT EXISTS "vault_assets_uploaderId_idx" ON "vault_assets"("uploaderId");
CREATE INDEX IF NOT EXISTS "vault_assets_scanStatus_idx" ON "vault_assets"("scanStatus");

CREATE INDEX IF NOT EXISTS "vault_events_riftId_timestampUtc_idx" ON "vault_events"("riftId", "timestampUtc");
CREATE INDEX IF NOT EXISTS "vault_events_assetId_idx" ON "vault_events"("assetId");
CREATE INDEX IF NOT EXISTS "vault_events_actorId_actorRole_idx" ON "vault_events"("actorId", "actorRole");
CREATE INDEX IF NOT EXISTS "vault_events_eventType_idx" ON "vault_events"("eventType");
CREATE INDEX IF NOT EXISTS "vault_events_logHash_idx" ON "vault_events"("logHash");

CREATE INDEX IF NOT EXISTS "admin_reviews_riftId_idx" ON "admin_reviews"("riftId");
CREATE INDEX IF NOT EXISTS "admin_reviews_status_idx" ON "admin_reviews"("status");
CREATE INDEX IF NOT EXISTS "admin_reviews_reviewerId_idx" ON "admin_reviews"("reviewerId");

-- AddForeignKey (only if referenced tables exist)
DO $$ 
BEGIN
  -- Check if EscrowTransaction table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'EscrowTransaction') THEN
    -- Add foreign keys to vault_assets
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'vault_assets_riftId_fkey'
    ) THEN
      ALTER TABLE "vault_assets" ADD CONSTRAINT "vault_assets_riftId_fkey" 
        FOREIGN KEY ("riftId") REFERENCES "EscrowTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    -- Add foreign keys to vault_events
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'vault_events_riftId_fkey'
    ) THEN
      ALTER TABLE "vault_events" ADD CONSTRAINT "vault_events_riftId_fkey" 
        FOREIGN KEY ("riftId") REFERENCES "EscrowTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    -- Add foreign keys to admin_reviews
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'admin_reviews_riftId_fkey'
    ) THEN
      ALTER TABLE "admin_reviews" ADD CONSTRAINT "admin_reviews_riftId_fkey" 
        FOREIGN KEY ("riftId") REFERENCES "EscrowTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
  
  -- Check if User table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'vault_assets_uploaderId_fkey'
    ) THEN
      ALTER TABLE "vault_assets" ADD CONSTRAINT "vault_assets_uploaderId_fkey" 
        FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'admin_reviews_reviewerId_fkey'
    ) THEN
      ALTER TABLE "admin_reviews" ADD CONSTRAINT "admin_reviews_reviewerId_fkey" 
        FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
  
  -- Self-referencing foreign key for vault_assets
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'vault_assets_supersedesAssetId_fkey'
  ) THEN
    ALTER TABLE "vault_assets" ADD CONSTRAINT "vault_assets_supersedesAssetId_fkey" 
      FOREIGN KEY ("supersedesAssetId") REFERENCES "vault_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  
  -- Foreign key from vault_events to vault_assets
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'vault_events_assetId_fkey'
  ) THEN
    ALTER TABLE "vault_events" ADD CONSTRAINT "vault_events_assetId_fkey" 
      FOREIGN KEY ("assetId") REFERENCES "vault_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

