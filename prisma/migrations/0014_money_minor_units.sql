-- Additive monetary snapshots. Historical REAL amounts remain untouched until
-- a production data audit and a separately reviewed backfill/reconciliation.
ALTER TABLE "Product" ADD COLUMN "priceMinor" INTEGER;
ALTER TABLE "Product" ADD COLUMN "compareAtMinor" INTEGER;

ALTER TABLE "Order" ADD COLUMN "currency" TEXT;
ALTER TABLE "Order" ADD COLUMN "subtotalMinor" INTEGER;
ALTER TABLE "Order" ADD COLUMN "shippingMinor" INTEGER;
ALTER TABLE "Order" ADD COLUMN "discountMinor" INTEGER;
ALTER TABLE "Order" ADD COLUMN "totalMinor" INTEGER;

ALTER TABLE "OrderItem" ADD COLUMN "priceMinor" INTEGER;
