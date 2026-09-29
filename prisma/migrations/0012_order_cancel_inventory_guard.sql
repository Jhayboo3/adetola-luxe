-- Restore stock exactly once when an order first becomes cancelled.
-- The trigger runs in the same SQLite transaction as the status update.
CREATE TRIGGER "Order_cancel_restore_stock"
AFTER UPDATE OF "status" ON "Order"
WHEN NEW."status" = 'cancelled' AND OLD."status" <> 'cancelled'
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

-- Reopening a cancelled order would require a fresh stock reservation.
CREATE TRIGGER "Order_cancel_reopen_guard"
BEFORE UPDATE OF "status" ON "Order"
WHEN OLD."status" = 'cancelled' AND NEW."status" <> 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'Cancelled order cannot be reopened');
END;
