-- Add item-specific fields to RiftTransaction table
-- This migration uses DO blocks to safely add columns only if the table exists

DO $$
BEGIN
    -- Check if EscrowTransaction table exists, if so add columns
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'EscrowTransaction') THEN
        -- Ticket-specific fields
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'ticketPlatform') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "ticketPlatform" TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'seatDetails') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "seatDetails" TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'quantity') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "quantity" INTEGER;
        END IF;

        -- Digital file-specific fields
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'fileUploadPath') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "fileUploadPath" TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'fileHash') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "fileHash" TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'fileSize') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "fileSize" INTEGER;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'virusScanStatus') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "virusScanStatus" TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'fileStorageType') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "fileStorageType" TEXT;
        END IF;

        -- License key-specific fields
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'licenseKeyType') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "licenseKeyType" TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'licensePlatform') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "licensePlatform" TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'licenseKeyRevealed') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "licenseKeyRevealed" BOOLEAN DEFAULT false;
        END IF;

        -- Service-specific fields
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'serviceScope') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "serviceScope" TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'serviceDeliverables') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "serviceDeliverables" TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'completionCriteria') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "completionCriteria" TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'allowsPartialRelease') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "allowsPartialRelease" BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'EscrowTransaction' AND column_name = 'milestones') THEN
            ALTER TABLE "EscrowTransaction" ADD COLUMN "milestones" JSONB;
        END IF;
    END IF;
END $$;

-- Create VaultFile table for tracking vault files
CREATE TABLE IF NOT EXISTS "vault_files" (
    "id" TEXT NOT NULL,
    "riftId" TEXT,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "virusScanStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "virusScannedAt" TIMESTAMP(3),
    "viewOnly" BOOLEAN NOT NULL DEFAULT true,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "encryptedData" TEXT,
    "metadata" JSONB,

    CONSTRAINT "vault_files_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "vault_files_storagePath_key" ON "vault_files"("storagePath");
CREATE UNIQUE INDEX IF NOT EXISTS "vault_files_fileHash_key" ON "vault_files"("fileHash");
CREATE INDEX IF NOT EXISTS "vault_files_riftId_idx" ON "vault_files"("riftId");
CREATE INDEX IF NOT EXISTS "vault_files_fileHash_idx" ON "vault_files"("fileHash");
CREATE INDEX IF NOT EXISTS "vault_files_uploadedBy_idx" ON "vault_files"("uploadedBy");

-- Add foreign key (only if EscrowTransaction table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'EscrowTransaction') THEN
        IF NOT EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE constraint_name = 'vault_files_riftId_fkey'
        ) THEN
            ALTER TABLE "vault_files" ADD CONSTRAINT "vault_files_riftId_fkey" 
            FOREIGN KEY ("riftId") REFERENCES "EscrowTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
