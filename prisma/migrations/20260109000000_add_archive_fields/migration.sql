-- AlterTable
ALTER TABLE "EscrowTransaction" ADD COLUMN "buyerArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sellerArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "buyerArchivedAt" TIMESTAMP(3),
ADD COLUMN "sellerArchivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EscrowTransaction_buyerArchived_idx" ON "EscrowTransaction"("buyerArchived");
CREATE INDEX "EscrowTransaction_sellerArchived_idx" ON "EscrowTransaction"("sellerArchived");
