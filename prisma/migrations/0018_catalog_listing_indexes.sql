-- Measured on an isolated 5,009-product local fixture. Global eligible-product
-- newest/price pages otherwise scan Product and use a temporary sort B-tree.
CREATE INDEX "Product_catalog_newest_idx" ON "Product"("published", "createdAt" DESC, "id" DESC);
CREATE INDEX "Product_catalog_price_idx" ON "Product"("published", "price" ASC, "id" DESC);
