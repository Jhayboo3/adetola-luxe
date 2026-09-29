-- Shipped/delivered goods must not be returned to sellable stock by a simple
-- cancellation. Returns/refunds need their own explicit inventory workflow.
CREATE TRIGGER "Order_late_cancellation_guard"
BEFORE UPDATE OF "status" ON "Order"
WHEN NEW."status" = 'cancelled' AND OLD."status" IN ('shipped', 'delivered')
BEGIN
  SELECT RAISE(ABORT, 'Shipped or delivered order cannot be cancelled');
END;

CREATE TRIGGER "Order_delivered_terminal_guard"
BEFORE UPDATE OF "status" ON "Order"
WHEN OLD."status" = 'delivered' AND NEW."status" <> 'delivered'
BEGIN
  SELECT RAISE(ABORT, 'Delivered order cannot be reopened');
END;
