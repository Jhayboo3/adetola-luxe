-- One immutable request identity groups the vendor orders from one checkout.
-- Existing orders remain valid with a NULL checkoutId; no historical totals
-- or customer data are rewritten by this migration.
CREATE TABLE "Checkout" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Checkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Checkout_tokenHash_key" ON "Checkout"("tokenHash");
CREATE INDEX "Checkout_userId_createdAt_idx" ON "Checkout"("userId", "createdAt");

ALTER TABLE "Order" ADD COLUMN "checkoutId" TEXT REFERENCES "Checkout"("id") ON DELETE RESTRICT;
CREATE INDEX "Order_checkoutId_idx" ON "Order"("checkoutId");
