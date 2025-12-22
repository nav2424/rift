-- AlterTable
ALTER TABLE "User" ADD COLUMN "riftUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_riftUserId_key" ON "User"("riftUserId");

-- CreateIndex
CREATE INDEX "User_riftUserId_idx" ON "User"("riftUserId");
