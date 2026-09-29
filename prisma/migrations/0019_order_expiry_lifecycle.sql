-- Order lifecycle: automatic expiry + WhatsApp handoff / vendor acceptance metadata.
--
-- Additive and back-compatible: new nullable columns, one index and three
-- triggers. Historical rows are not rewritten and no timestamp is backfilled.
-- Reservation window (12h from createdAt by default) is enforced by the
-- application sweep; these triggers enforce who may enter 'expired' and restore
-- inventory exactly once, mirroring 0012's cancellation guard.

ALTER TABLE "Order" ADD COLUMN "vendorContactOpenedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "acceptedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "rejectionReason" TEXT;

CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- Restore reserved stock exactly once on the first transition into 'expired'.
CREATE TRIGGER "Order_expire_restore_stock"
AFTER UPDATE OF "status" ON "Order"
WHEN NEW."status" = 'expired' AND OLD."status" <> 'expired'
BEGIN
  UPDATE "Product"
  SET "stock" = "stock" + (
    SELECT COALESCE(SUM("quantity"), 0)
    FROM "OrderItem"
    WHERE "orderId" = NEW."id" AND "productId" = "Product"."id"
  ), "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" IN (SELECT "productId" FROM "OrderItem" WHERE "orderId" = NEW."id")
    AND "storeId" = NEW."storeId";
END;

-- Only an unconfirmed order may expire. A repeat run (OLD already 'expired')
-- is a no-op rather than an abort, so the sweep is idempotent.
CREATE TRIGGER "Order_expire_scope_guard"
BEFORE UPDATE OF "status" ON "Order"
WHEN NEW."status" = 'expired' AND OLD."status" <> 'expired'
  AND OLD."status" NOT IN ('sent_to_whatsapp', 'pending')
BEGIN
  SELECT RAISE(ABORT, 'Only an unconfirmed order can expire');
END;

-- Expired is terminal.
CREATE TRIGGER "Order_expired_reopen_guard"
BEFORE UPDATE OF "status" ON "Order"
WHEN OLD."status" = 'expired' AND NEW."status" <> 'expired'
BEGIN
  SELECT RAISE(ABORT, 'Expired order cannot be reopened');
END;
