-- CreateTable
CREATE TABLE IF NOT EXISTS "MilestoneRelease" (
    "id" TEXT NOT NULL,
    "riftId" TEXT NOT NULL,
    "milestoneIndex" INTEGER NOT NULL,
    "milestoneTitle" TEXT NOT NULL,
    "milestoneAmount" DOUBLE PRECISION NOT NULL,
    "releasedAmount" DOUBLE PRECISION NOT NULL,
    "sellerFee" DOUBLE PRECISION NOT NULL,
    "sellerNet" DOUBLE PRECISION NOT NULL,
    "releasedBy" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'RELEASED',
    "payoutId" TEXT,
    "notes" TEXT,

    CONSTRAINT "MilestoneRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MilestoneRelease_riftId_idx" ON "MilestoneRelease"("riftId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MilestoneRelease_releasedBy_idx" ON "MilestoneRelease"("releasedBy");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MilestoneRelease_releasedAt_idx" ON "MilestoneRelease"("releasedAt");

-- AddForeignKey
DO $$ 
BEGIN
    -- Only create foreign key if EscrowTransaction table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'EscrowTransaction'
    ) THEN
        -- Check if constraint already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'MilestoneRelease_riftId_fkey'
        ) THEN
            ALTER TABLE "MilestoneRelease" ADD CONSTRAINT "MilestoneRelease_riftId_fkey" 
            FOREIGN KEY ("riftId") REFERENCES "EscrowTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

