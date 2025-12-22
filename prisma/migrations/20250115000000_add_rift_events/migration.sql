-- CreateEnum
CREATE TYPE "RiftEventActorType" AS ENUM ('BUYER', 'SELLER', 'SYSTEM', 'ADMIN');

-- CreateTable
CREATE TABLE "rift_events" (
    "id" TEXT NOT NULL,
    "riftId" TEXT NOT NULL,
    "actorType" "RiftEventActorType" NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "ipHash" TEXT,
    "deviceFingerprint" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rift_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rift_events_riftId_createdAt_idx" ON "rift_events"("riftId", "createdAt");

-- CreateIndex
CREATE INDEX "rift_events_eventType_idx" ON "rift_events"("eventType");

-- CreateIndex
CREATE INDEX "rift_events_actorType_actorId_idx" ON "rift_events"("actorType", "actorId");

-- AddForeignKey
ALTER TABLE "rift_events" ADD CONSTRAINT "rift_events_riftId_fkey" FOREIGN KEY ("riftId") REFERENCES "EscrowTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
