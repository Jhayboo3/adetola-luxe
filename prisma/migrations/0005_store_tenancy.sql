-- Multi-tenant storefront platform: introduce Store and scope all business
-- entities (products, categories, orders, discount codes, order items) to it.
--
-- Data-integrity idempotency (re-running never duplicates the store or
-- reassigns a record twice):
--  * The Store row is inserted with INSERT OR IGNORE, keyed by its slug, so
--    the store is created only if it does not already exist.
--  * Existing records are only reassigned while their storeId is still NULL,
--    so a re-run never overwrites an already-assigned store.
--
-- The DDL statements (CREATE TABLE / CREATE INDEX / DROP INDEX) use IF NOT
-- EXISTS / IF EXISTS guards so they are safe to re-run. Like all SQLite DDL,
-- the five ALTER TABLE ADD COLUMN statements run once under normal D1
-- migration semantics (SQLite has no ADD COLUMN IF NOT EXISTS); a manual
-- re-run of the file halts harmlessly at those lines with nothing duplicated.
--
-- NOTE: The exact store name/spelling ("TNC Collections", slug "tnc-collections")
-- must be confirmed against production data before this is shipped.

CREATE TABLE IF NOT EXISTS "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Store_slug_key" ON "Store"("slug");
CREATE INDEX IF NOT EXISTS "Store_ownerId_idx" ON "Store"("ownerId");

-- Ensure the TNC Collections store exists, owned by the first admin user.
INSERT OR IGNORE INTO "Store" ("id", "name", "slug", "logo", "ownerId", "createdAt", "updatedAt")
SELECT
    'store_tnc_collections',
    'TNC Collections',
    'tnc-collections',
    NULL,
    (SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "createdAt" ASC LIMIT 1),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP;

-- Scope every store-owned entity to the TNC Collections store.
ALTER TABLE "Category" ADD COLUMN "storeId" TEXT;
ALTER TABLE "Product" ADD COLUMN "storeId" TEXT;
ALTER TABLE "Order" ADD COLUMN "storeId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "storeId" TEXT;
ALTER TABLE "DiscountCode" ADD COLUMN "storeId" TEXT;

UPDATE "Category" SET "storeId" = (SELECT "id" FROM "Store" WHERE "slug" = 'tnc-collections' LIMIT 1) WHERE "storeId" IS NULL;
UPDATE "Product" SET "storeId" = (SELECT "id" FROM "Store" WHERE "slug" = 'tnc-collections' LIMIT 1) WHERE "storeId" IS NULL;
UPDATE "Order" SET "storeId" = (SELECT "id" FROM "Store" WHERE "slug" = 'tnc-collections' LIMIT 1) WHERE "storeId" IS NULL;
UPDATE "OrderItem" SET "storeId" = (SELECT "id" FROM "Store" WHERE "slug" = 'tnc-collections' LIMIT 1) WHERE "storeId" IS NULL;
UPDATE "DiscountCode" SET "storeId" = (SELECT "id" FROM "Store" WHERE "slug" = 'tnc-collections' LIMIT 1) WHERE "storeId" IS NULL;

-- Replace global unique constraints with store-scoped composite uniqueness so
-- each seller may reuse slugs/codes without collisions.
DROP INDEX IF EXISTS "Category_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Category_storeId_slug_key" ON "Category"("storeId", "slug");

DROP INDEX IF EXISTS "Product_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Product_storeId_slug_key" ON "Product"("storeId", "slug");
CREATE INDEX IF NOT EXISTS "Product_storeId_categoryId_idx" ON "Product"("storeId", "categoryId");

DROP INDEX IF EXISTS "Order_orderCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Order_storeId_orderCode_key" ON "Order"("storeId", "orderCode");

DROP INDEX IF EXISTS "Order_checkoutToken_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Order_storeId_checkoutToken_key" ON "Order"("storeId", "checkoutToken");

DROP INDEX IF EXISTS "DiscountCode_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "DiscountCode_storeId_code_key" ON "DiscountCode"("storeId", "code");

CREATE INDEX IF NOT EXISTS "Order_storeId_idx" ON "Order"("storeId");
CREATE INDEX IF NOT EXISTS "OrderItem_storeId_idx" ON "OrderItem"("storeId");
