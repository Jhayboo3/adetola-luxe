-- Guest checkout: record the customer's fixed garment size on each order.
-- The size replaces the previous per-order body-measurement capture, so the
-- measurement fields are kept (nullable) but no longer required.
ALTER TABLE "Order" ADD COLUMN "size" TEXT;
