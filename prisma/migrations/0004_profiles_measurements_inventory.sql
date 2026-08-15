ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "User" ADD COLUMN "gender" TEXT;
ALTER TABLE "User" ADD COLUMN "address" TEXT;
ALTER TABLE "User" ADD COLUMN "state" TEXT;
ALTER TABLE "User" ADD COLUMN "city" TEXT;
ALTER TABLE "User" ADD COLUMN "zip" TEXT;
ALTER TABLE "User" ADD COLUMN "deliveryInfo" TEXT;
ALTER TABLE "User" ADD COLUMN "measurementUnit" TEXT NOT NULL DEFAULT 'inches';
ALTER TABLE "User" ADD COLUMN "measurements" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Product" ADD COLUMN "clothingType" TEXT;
ALTER TABLE "Product" ADD COLUMN "targetGender" TEXT NOT NULL DEFAULT 'Unisex';

ALTER TABLE "Order" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryInfo" TEXT;
ALTER TABLE "Order" ADD COLUMN "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "Order" ADD COLUMN "checkoutToken" TEXT;
ALTER TABLE "Order" ADD COLUMN "gender" TEXT;
ALTER TABLE "Order" ADD COLUMN "measurementUnit" TEXT;
ALTER TABLE "Order" ADD COLUMN "measurementSnapshot" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Order" ADD COLUMN "measurementCapturedAt" DATETIME;

CREATE UNIQUE INDEX "Order_checkoutToken_key" ON "Order"("checkoutToken");
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

CREATE TRIGGER "Product_stock_insert_guard"
BEFORE INSERT ON "Product"
WHEN NEW."stock" < 0
BEGIN
  SELECT RAISE(ABORT, 'Stock cannot be negative');
END;

CREATE TRIGGER "Product_stock_update_guard"
BEFORE UPDATE OF "stock" ON "Product"
WHEN NEW."stock" < 0
BEGIN
  SELECT RAISE(ABORT, 'Stock cannot be negative');
END;

CREATE TRIGGER "OrderItem_inventory_guard"
BEFORE INSERT ON "OrderItem"
BEGIN
  SELECT CASE
    WHEN NEW."quantity" <= 0 THEN RAISE(ABORT, 'Invalid order quantity')
    WHEN COALESCE((SELECT "stock" FROM "Product" WHERE "id" = NEW."productId"), 0) < NEW."quantity"
      THEN RAISE(ABORT, 'Insufficient stock')
  END;
  UPDATE "Product"
  SET "stock" = "stock" - NEW."quantity", "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."productId";
END;
