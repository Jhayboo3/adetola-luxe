import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { canTransitionOrderStatus } from "../src/lib/orders.ts";

const inventoryMigration = readFileSync(new URL("../prisma/migrations/0012_order_cancel_inventory_guard.sql", import.meta.url), "utf8");
const transitionMigration = readFileSync(new URL("../prisma/migrations/0015_order_transition_guards.sql", import.meta.url), "utf8");

test("fulfillment transitions are monotonic", () => {
  assert.equal(canTransitionOrderStatus("sent_to_whatsapp", "confirmed"), true);
  assert.equal(canTransitionOrderStatus("confirmed", "shipped"), true);
  assert.equal(canTransitionOrderStatus("shipped", "delivered"), true);
  assert.equal(canTransitionOrderStatus("confirmed", "cancelled"), true);
  assert.equal(canTransitionOrderStatus("shipped", "cancelled"), false);
  assert.equal(canTransitionOrderStatus("delivered", "processing"), false);
  assert.equal(canTransitionOrderStatus("cancelled", "confirmed"), false);
});

test("database rejects late cancellation without restoring stock", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "status" TEXT NOT NULL);
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "stock" INTEGER NOT NULL, "updatedAt" TEXT);
      CREATE TABLE "OrderItem" ("orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
      INSERT INTO "Order" VALUES ('shipped-order', 'store-a', 'shipped');
      INSERT INTO "Order" VALUES ('delivered-order', 'store-a', 'delivered');
      INSERT INTO "Product" VALUES ('product-a', 'store-a', 2, NULL);
      INSERT INTO "OrderItem" VALUES ('shipped-order', 'product-a', 1);
      INSERT INTO "OrderItem" VALUES ('delivered-order', 'product-a', 1);
    `);
    db.exec(inventoryMigration);
    db.exec(transitionMigration);
    assert.throws(() => db.exec(`UPDATE "Order" SET "status" = 'cancelled' WHERE "id" = 'shipped-order'`), /cannot be cancelled/);
    assert.throws(() => db.exec(`UPDATE "Order" SET "status" = 'cancelled' WHERE "id" = 'delivered-order'`), /cannot be cancelled|cannot be reopened/);
    assert.throws(() => db.exec(`UPDATE "Order" SET "status" = 'processing' WHERE "id" = 'delivered-order'`), /cannot be reopened/);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id" = 'product-a'`).get().stock, 2);
  } finally {
    db.close();
  }
});
