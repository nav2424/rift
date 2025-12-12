-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
INSERT INTO "new_EscrowTransaction" ("amount", "buyerId", "createdAt", "currency", "id", "itemDescription", "itemTitle", "notes", "paymentReference", "sellerId", "shippingAddress", "status", "updatedAt") SELECT "amount", "buyerId", "createdAt", "currency", "id", "itemDescription", "itemTitle", "notes", "paymentReference", "sellerId", "shippingAddress", "status", "updatedAt" FROM "EscrowTransaction";
DROP TABLE "EscrowTransaction";
ALTER TABLE "new_EscrowTransaction" RENAME TO "EscrowTransaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
