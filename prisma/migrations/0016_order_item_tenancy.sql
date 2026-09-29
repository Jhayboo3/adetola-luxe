-- Order, item and product must share a store. The existing stock trigger
-- decrements the product on insert; this guard aborts the entire statement if
-- a cross-store item is attempted, so no stock change can commit.
CREATE TRIGGER "OrderItem_store_insert_guard"
BEFORE INSERT ON "OrderItem"
WHEN NEW."storeId" IS NULL
  OR NEW."storeId" <> (SELECT "storeId" FROM "Order" WHERE "id" = NEW."orderId")
  OR NEW."storeId" <> (SELECT "storeId" FROM "Product" WHERE "id" = NEW."productId")
BEGIN
  SELECT RAISE(ABORT, 'Order item store mismatch');
END;

-- Order lines are immutable after placement. A correction must be a separate
-- auditable adjustment rather than silently changing sold quantity or price.
CREATE TRIGGER "OrderItem_identity_update_guard"
BEFORE UPDATE OF "storeId", "orderId", "productId", "quantity", "price", "priceMinor" ON "OrderItem"
WHEN NEW."storeId" IS NOT OLD."storeId"
  OR NEW."orderId" IS NOT OLD."orderId"
  OR NEW."productId" IS NOT OLD."productId"
  OR NEW."quantity" IS NOT OLD."quantity"
  OR NEW."price" IS NOT OLD."price"
  OR NEW."priceMinor" IS NOT OLD."priceMinor"
BEGIN
  SELECT RAISE(ABORT, 'Order item identity and price are immutable');
END;

CREATE TRIGGER "Order_store_update_guard"
BEFORE UPDATE OF "storeId" ON "Order"
WHEN NEW."storeId" IS NOT OLD."storeId"
BEGIN
  SELECT RAISE(ABORT, 'Order store is immutable');
END;

CREATE TRIGGER "Product_store_update_guard"
BEFORE UPDATE OF "storeId" ON "Product"
WHEN NEW."storeId" IS NOT OLD."storeId"
BEGIN
  SELECT RAISE(ABORT, 'Product store is immutable');
END;
