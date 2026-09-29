-- Persist each order's reservation deadline and support product-scoped expiry.
--
-- Why: the reservation deadline was computed at mutation/sweep time from the
-- current ORDER_RESERVATION_WINDOW_HOURS, so an operator changing the window
-- silently moved existing orders' deadlines. It also meant a stale, unswept
-- reservation could still block a new checkout. This migration stores the
-- deadline once at order creation and indexes the product lookup used by the
-- targeted cleanup.
--
-- Additive. Historical rows keep reservationExpiresAt = NULL, which is treated
-- as "grandfathered" (never auto-expired, never product-cleaned) so no existing
-- order's state or inventory is changed by this migration. The owner may choose
-- to backfill during the production rehearsal after reviewing order states.

ALTER TABLE "Order" ADD COLUMN "reservationExpiresAt" DATETIME;

-- The expiry queries filter by status and order on the deadline, not createdAt.
DROP INDEX IF EXISTS "Order_status_createdAt_idx";
CREATE INDEX "Order_status_reservationExpiresAt_idx" ON "Order"("status", "reservationExpiresAt");

-- Targeted cleanup joins OrderItem by productId.
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
