/*
  Warnings:

  - Added the required column `updatedAt` to the `ShipmentProof` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escrowId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ITEM_NOT_RECEIVED',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "resolvedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "EscrowTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Dispute_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Dispute" ("adminNote", "createdAt", "escrowId", "id", "raisedById", "reason", "resolvedById", "status", "updatedAt") SELECT "adminNote", "createdAt", "escrowId", "id", "raisedById", "reason", "resolvedById", "status", "updatedAt" FROM "Dispute";
DROP TABLE "Dispute";
ALTER TABLE "new_Dispute" RENAME TO "Dispute";
CREATE TABLE "new_EscrowTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemTitle" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'PHYSICAL',
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "shippingAddress" TEXT,
    "notes" TEXT,
    "paymentReference" TEXT,
    "stripePaymentIntentId" TEXT,
    "shipmentVerifiedAt" DATETIME,
    "trackingVerified" BOOLEAN NOT NULL DEFAULT false,
    "deliveryVerifiedAt" DATETIME,
    "gracePeriodEndsAt" DATETIME,
    "autoReleaseScheduled" BOOLEAN NOT NULL DEFAULT false,
    "eventDate" TEXT,
    "venue" TEXT,
    "transferMethod" TEXT,
    "downloadLink" TEXT,
    "licenseKey" TEXT,
    "serviceDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EscrowTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EscrowTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EscrowTransaction" ("amount", "buyerId", "createdAt", "currency", "downloadLink", "eventDate", "id", "itemDescription", "itemTitle", "itemType", "licenseKey", "notes", "paymentReference", "sellerId", "serviceDate", "shippingAddress", "status", "stripePaymentIntentId", "transferMethod", "updatedAt", "venue") SELECT "amount", "buyerId", "createdAt", "currency", "downloadLink", "eventDate", "id", "itemDescription", "itemTitle", "itemType", "licenseKey", "notes", "paymentReference", "sellerId", "serviceDate", "shippingAddress", "status", "stripePaymentIntentId", "transferMethod", "updatedAt", "venue" FROM "EscrowTransaction";
DROP TABLE "EscrowTransaction";
ALTER TABLE "new_EscrowTransaction" RENAME TO "EscrowTransaction";
CREATE TABLE "new_ShipmentProof" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escrowId" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "shippingCarrier" TEXT,
    "filePath" TEXT,
    "notes" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "deliveryStatus" TEXT,
    "deliveryDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShipmentProof_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "EscrowTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ShipmentProof" ("createdAt", "escrowId", "filePath", "id", "notes", "shippingCarrier", "trackingNumber", "updatedAt") SELECT "createdAt", "escrowId", "filePath", "id", "notes", "shippingCarrier", "trackingNumber", "createdAt" FROM "ShipmentProof";
DROP TABLE "ShipmentProof";
ALTER TABLE "new_ShipmentProof" RENAME TO "ShipmentProof";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
