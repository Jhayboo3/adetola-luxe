import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const migration = readFileSync(new URL("../prisma/migrations/0016_order_item_tenancy.sql", import.meta.url), "utf8");

test("cross-store order items cannot consume or misallocate inventory", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL);
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "stock" INTEGER NOT NULL);
      CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "price" REAL NOT NULL, "priceMinor" INTEGER);
      CREATE TRIGGER "stock_on_insert" BEFORE INSERT ON "OrderItem" BEGIN
        UPDATE "Product" SET "stock" = "stock" - NEW."quantity" WHERE "id" = NEW."productId";
      END;
      INSERT INTO "Order" VALUES ('order-a', 'store-a');
      INSERT INTO "Product" VALUES ('product-a', 'store-a', 3);
      INSERT INTO "Product" VALUES ('product-b', 'store-b', 3);
    `);
    db.exec(migration);

    const insert = db.prepare('INSERT INTO "OrderItem" VALUES (?,?,?,?,?,?,?)');
    assert.throws(() => insert.run("bad-item", "store-a", "order-a", "product-b", 1, 10, 1000), /store mismatch/);
    assert.equal(db.prepare('SELECT "stock" FROM "Product" WHERE "id" = ?').get("product-b").stock, 3);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM "OrderItem"').get().count, 0);

    insert.run("good-item", "store-a", "order-a", "product-a", 1, 10, 1000);
    assert.equal(db.prepare('SELECT "stock" FROM "Product" WHERE "id" = ?').get("product-a").stock, 2);
    assert.throws(() => db.exec(`UPDATE "OrderItem" SET "quantity" = 2 WHERE "id" = 'good-item'`), /immutable/);
    assert.throws(() => db.exec(`UPDATE "Order" SET "storeId" = 'store-b' WHERE "id" = 'order-a'`), /immutable/);
    assert.throws(() => db.exec(`UPDATE "Product" SET "storeId" = 'store-b' WHERE "id" = 'product-a'`), /immutable/);
  } finally {
    db.close();
  }
});
