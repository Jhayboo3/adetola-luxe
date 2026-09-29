import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const migration = readFileSync(new URL("../prisma/migrations/0014_money_minor_units.sql", import.meta.url), "utf8");

test("integer-money migration preserves historical REAL values without rounding them", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "price" REAL, "compareAt" REAL);
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "subtotal" REAL, "shipping" REAL, "discount" REAL, "total" REAL);
      CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY, "price" REAL);
      INSERT INTO "Product" VALUES ('product-a', 1.005, NULL);
      INSERT INTO "Order" VALUES ('order-a', 1.005, 0, NULL, 1.005);
      INSERT INTO "OrderItem" VALUES ('item-a', 1.005);
    `);
    db.exec(migration);
    const product = db.prepare('SELECT "price", "priceMinor" FROM "Product" WHERE "id" = ?').get("product-a");
    const order = db.prepare('SELECT "total", "totalMinor", "currency" FROM "Order" WHERE "id" = ?').get("order-a");
    const item = db.prepare('SELECT "price", "priceMinor" FROM "OrderItem" WHERE "id" = ?').get("item-a");
    assert.deepEqual([product.price, product.priceMinor], [1.005, null]);
    assert.deepEqual([order.total, order.totalMinor, order.currency], [1.005, null, null]);
    assert.deepEqual([item.price, item.priceMinor], [1.005, null]);
  } finally {
    db.close();
  }
});
