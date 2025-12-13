-- AddRiftNumber
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EscrowTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riftNumber" INTEGER NOT NULL,
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
    "platformFee" REAL,
    "sellerPayoutAmount" REAL,
    CONSTRAINT "EscrowTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EscrowTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Copy existing data and assign sequential rift numbers starting from 1000
INSERT INTO "new_EscrowTransaction" (
    "id", "riftNumber", "itemTitle", "itemDescription", "itemType", "amount", "currency", 
    "status", "buyerId", "sellerId", "shippingAddress", "notes", "paymentReference", 
    "stripePaymentIntentId", "shipmentVerifiedAt", "trackingVerified", "deliveryVerifiedAt", 
    "gracePeriodEndsAt", "autoReleaseScheduled", "eventDate", "venue", "transferMethod", 
    "downloadLink", "licenseKey", "serviceDate", "createdAt", "updatedAt", "platformFee", "sellerPayoutAmount"
)
SELECT 
    "id",
    1000 + (SELECT COUNT(*) FROM "EscrowTransaction" e2 WHERE e2."createdAt" <= "EscrowTransaction"."createdAt" AND e2."id" <= "EscrowTransaction"."id"),
    "itemTitle", "itemDescription", "itemType", "amount", "currency", 
    "status", "buyerId", "sellerId", "shippingAddress", "notes", "paymentReference", 
    "stripePaymentIntentId", "shipmentVerifiedAt", "trackingVerified", "deliveryVerifiedAt", 
    "gracePeriodEndsAt", "autoReleaseScheduled", "eventDate", "venue", "transferMethod", 
    "downloadLink", "licenseKey", "serviceDate", "createdAt", "updatedAt", "platformFee", "sellerPayoutAmount"
FROM "EscrowTransaction"
ORDER BY "createdAt", "id";

DROP TABLE "EscrowTransaction";
ALTER TABLE "new_EscrowTransaction" RENAME TO "EscrowTransaction";
CREATE UNIQUE INDEX "EscrowTransaction_riftNumber_key" ON "EscrowTransaction"("riftNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
