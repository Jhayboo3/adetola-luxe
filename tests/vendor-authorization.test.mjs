import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { canTransitionOrderStatus } from "../src/lib/orders.ts";

// These tests exercise the same store-scoped SQL predicates the vendor and admin
// server actions rely on. They model two approved stores, each with a product
// and an order, and assert that a caller scoped to one store can never read or
// mutate the other store's rows, that only allowed status transitions apply,
// and that suspending a store removes it from the public eligibility predicate.

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE "Store" ("id" TEXT PRIMARY KEY, "status" TEXT NOT NULL);
    CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "published" INTEGER NOT NULL, "stock" INTEGER NOT NULL, "priceMinor" INTEGER);
    CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "status" TEXT NOT NULL, "paymentStatus" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "updatedAt" TEXT);
    CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
    INSERT INTO "Store" VALUES ('store-a', 'approved'), ('store-b', 'approved');
    INSERT INTO "Product" VALUES ('product-a', 'store-a', 1, 5, 1000), ('product-b', 'store-b', 1, 5, 2000);
    INSERT INTO "Order" VALUES ('order-a', 'store-a', 'sent_to_whatsapp', 'pending', 'Customer A', 'a@example.invalid', NULL);
    INSERT INTO "Order" VALUES ('order-b', 'store-b', 'sent_to_whatsapp', 'pending', 'Customer B', 'b@example.invalid', NULL);
    INSERT INTO "OrderItem" VALUES ('item-a', 'store-a', 'order-a', 'product-a', 1), ('item-b', 'store-b', 'order-b', 'product-b', 1);
  `);
  return db;
}

const vendorOrderGuard = 'UPDATE "Order" SET "status" = ?, "paymentStatus" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND "storeId" = ? AND "status" = ? RETURNING "id"';

test("a vendor's guarded update cannot change another store's order", () => {
  const db = fixture();
  try {
    // Vendor B tries to cancel Vendor A's order by id, but is scoped to store-b.
    const crossStore = db.prepare(vendorOrderGuard).get("cancelled", "pending", "order-a", "store-b", "sent_to_whatsapp");
    assert.equal(crossStore, undefined);
    assert.equal(db.prepare('SELECT "status" FROM "Order" WHERE "id" = ?').get("order-a").status, "sent_to_whatsapp");
  } finally {
    db.close();
  }
});

test("a vendor's guarded update applies only an allowed transition to its own order", () => {
  const db = fixture();
  try {
    // Mirrors the server action: read the store-scoped row, validate the
    // transition in application code, then issue the guarded compare-and-set.
    const update = (storeId, id, next, nextPayment) => {
      const current = db.prepare('SELECT "status" FROM "Order" WHERE "id" = ? AND "storeId" = ?').get(id, storeId);
      if (!current || !canTransitionOrderStatus(current.status, next) || current.status === "cancelled") return null;
      return db.prepare(vendorOrderGuard).get(next, nextPayment, id, storeId, current.status);
    };

    assert.equal(update("store-a", "order-a", "shipped", "pending"), null, "sent_to_whatsapp -> shipped is not allowed");
    assert.equal(db.prepare('SELECT "status" FROM "Order" WHERE "id" = ?').get("order-a").status, "sent_to_whatsapp");

    const allowed = update("store-a", "order-a", "confirmed", "paid");
    assert.equal(allowed?.id, "order-a");
    const row = db.prepare('SELECT "status", "paymentStatus" FROM "Order" WHERE "id" = ?').get("order-a");
    assert.deepEqual({ ...row }, { status: "confirmed", paymentStatus: "paid" });
  } finally {
    db.close();
  }
});

test("store-scoped reads never expose another store's customer or order", () => {
  const db = fixture();
  try {
    const rows = db.prepare('SELECT "id", "name", "email" FROM "Order" WHERE "storeId" = ?').all("store-a").map((row) => ({ ...row }));
    assert.deepEqual(rows, [{ id: "order-a", name: "Customer A", email: "a@example.invalid" }]);
    const items = db.prepare('SELECT "id" FROM "OrderItem" WHERE "storeId" = ?').all("store-a").map((row) => ({ ...row }));
    assert.deepEqual(items, [{ id: "item-a" }]);
  } finally {
    db.close();
  }
});

test("suspending a store removes its products from the public eligibility predicate", () => {
  const db = fixture();
  try {
    const eligible = () => db.prepare(`
      SELECT "Product"."id" FROM "Product"
      JOIN "Store" ON "Store"."id" = "Product"."storeId"
      WHERE "Store"."status" = 'approved' AND "Product"."published" = 1 AND "Product"."stock" > 0
      ORDER BY "Product"."id"
    `).all().map((row) => row.id);
    assert.deepEqual(eligible(), ["product-a", "product-b"]);
    db.exec(`UPDATE "Store" SET "status" = 'suspended' WHERE "id" = 'store-a'`);
    assert.deepEqual(eligible(), ["product-b"]);
    db.exec(`UPDATE "Store" SET "status" = 'approved' WHERE "id" = 'store-a'`);
    db.exec(`UPDATE "Product" SET "published" = 0 WHERE "id" = 'product-a'`);
    assert.deepEqual(eligible(), ["product-b"]);
  } finally {
    db.close();
  }
});

test("only monotonic fulfillment transitions are permitted", () => {
  const allowed = [
    ["sent_to_whatsapp", "pending"],
    ["sent_to_whatsapp", "confirmed"],
    ["sent_to_whatsapp", "cancelled"],
    ["pending", "confirmed"],
    ["pending", "cancelled"],
    ["confirmed", "shipped"],
    ["confirmed", "cancelled"],
    ["shipped", "delivered"],
  ];
  for (const [from, to] of allowed) assert.equal(canTransitionOrderStatus(from, to), true, `${from} -> ${to}`);
  const rejected = [
    ["delivered", "cancelled"],
    ["delivered", "shipped"],
    ["shipped", "cancelled"],
    ["cancelled", "confirmed"],
  ];
  for (const [from, to] of rejected) assert.equal(canTransitionOrderStatus(from, to), false, `${from} -> ${to}`);
});
