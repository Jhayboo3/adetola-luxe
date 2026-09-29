-- Recheck marketplace eligibility inside the same transaction that creates
-- order items and decrements inventory. The API read can race a suspension or
-- product unpublish on another request.
CREATE TRIGGER order_item_checkout_eligibility_guard
BEFORE INSERT ON "OrderItem"
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM "Product" AS p
      JOIN "Store" AS s ON s."id" = p."storeId"
      WHERE p."id" = NEW."productId"
        AND p."published" = 1
        AND s."status" = 'approved'
    ) THEN RAISE(ABORT, 'Product or store unavailable')
  END;
END;
