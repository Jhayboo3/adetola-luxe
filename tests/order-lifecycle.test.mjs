import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { Worker } from "node:worker_threads";
import {
  canAcceptOrder,
  canCustomerCancelOrder,
  canExpireOrder,
  canVendorCancelOrder,
  isRejectionReason,
  rejectionReasonLabel,
} from "../src/lib/orders.ts";

// Database-lifecycle invariants for the order state machine: the 0012 (cancel)
// and 0019 (expire) triggers restore stock at most once, scope/reopen guards hold
// and terminal states stay terminal. Action-level deadline SQL is covered by
// tests/order-reservation-deadline.test.mjs.

const cancelMigration = readFileSync(new URL("../prisma/migrations/0012_order_cancel_inventory_guard.sql", import.meta.url), "utf8");
const expiryMigration = readFileSync(new URL("../prisma/migrations/0019_order_expiry_lifecycle.sql", import.meta.url), "utf8");
const deadlineMigration = readFileSync(new URL("../prisma/migrations/0020_order_reservation_deadline.sql", import.meta.url), "utf8");

const inventoryGuard = `
  CREATE TRIGGER "OrderItem_inventory_guard" BEFORE INSERT ON "OrderItem" BEGIN
    SELECT CASE
      WHEN NEW."quantity" <= 0 THEN RAISE(ABORT, 'Invalid order quantity')
      WHEN COALESCE((SELECT "stock" FROM "Product" WHERE "id" = NEW."productId"), 0) < NEW."quantity"
        THEN RAISE(ABORT, 'Insufficient stock')
    END;
    UPDATE "Product" SET "stock" = "stock" - NEW."quantity" WHERE "id" = NEW."productId";
  END;
`;

function schema(db) {
  db.exec(`
    CREATE TABLE "Order" (
      "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "status" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL, "updatedAt" TEXT, "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
      "userId" TEXT
    );
    CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "stock" INTEGER NOT NULL, "updatedAt" TEXT);
    CREATE TABLE "OrderItem" ("orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "storeId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
  `);
  db.exec(inventoryGuard);
  db.exec(cancelMigration);
  db.exec(expiryMigration);
  db.exec(deadlineMigration);
}

const insertOrder = (db, id, storeId, status, userId = null) =>
  db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt","updatedAt","userId") VALUES ('${id}','${storeId}','${status}','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z',${userId ? `'${userId}'` : "NULL"})`);
const item = (db, orderId, productId, storeId, quantity) =>
  db.exec(`INSERT INTO "OrderItem" ("orderId","productId","storeId","quantity") VALUES ('${orderId}','${productId}','${storeId}',${quantity})`);
const product = (db, id, storeId, st) => db.exec(`INSERT INTO "Product" ("id","storeId","stock","updatedAt") VALUES ('${id}','${storeId}',${st},NULL)`);
const stock = (db, id) => db.prepare('SELECT "stock" FROM "Product" WHERE "id"=?').get(id).stock;
const status = (db, id) => db.prepare('SELECT "status" FROM "Order" WHERE "id"=?').get(id).status;

const CONTACT_OPENED = `UPDATE "Order" SET "vendorContactOpenedAt" = ? WHERE "id" = ? AND "vendorContactOpenedAt" IS NULL`;
const VENDOR_CANCEL = `UPDATE "Order" SET "status"='cancelled', "rejectionReason"=? WHERE "id"=? AND "storeId"=? AND "status" IN ('sent_to_whatsapp','pending','confirmed')`;

const workerSource = `
  const { parentPort, workerData } = require('node:worker_threads');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(workerData.path);
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    const result = db.prepare(workerData.sql).run(...workerData.params);
    parentPort.postMessage({ changes: Number(result.changes) });
  } catch (error) {
    parentPort.postMessage({ error: String(error) });
  } finally { db.close(); }
`;
function runInWorker(path, sql, params = []) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerSource, { eval: true, workerData: { path, sql, params } });
    worker.once("message", (result) => result.error ? reject(new Error(result.error)) : resolve(result));
    worker.once("error", reject);
    worker.once("exit", (code) => { if (code !== 0) reject(new Error(`worker exited ${code}`)); });
  });
}
function tempDb() {
  const directory = mkdtempSync(join(tmpdir(), "larkvine-lifecycle-"));
  return { directory, path: join(directory, "orders.sqlite") };
}

test("status predicates gate expiry/accept/cancel correctly", () => {
  for (const s of ["sent_to_whatsapp", "pending"]) {
    assert.equal(canExpireOrder(s), true);
    assert.equal(canAcceptOrder(s), true);
    assert.equal(canCustomerCancelOrder(s), true);
    assert.equal(canVendorCancelOrder(s), true);
  }
  for (const s of ["confirmed", "shipped", "delivered", "cancelled", "expired"]) {
    assert.equal(canExpireOrder(s), false, s);
    assert.equal(canCustomerCancelOrder(s), false, s);
  }
  assert.equal(canVendorCancelOrder("confirmed"), true);
  assert.equal(canVendorCancelOrder("shipped"), false);
  assert.equal(rejectionReasonLabel("out_of_stock"), "Item is no longer in stock");
  assert.equal(isRejectionReason("other"), true);
  assert.equal(isRejectionReason("freetext note"), false);
  assert.equal(rejectionReasonLabel("freetext note"), null);
});

test("cancel and expiry restore stock exactly once", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    insertOrder(db, "c", "store-a", "confirmed");
    insertOrder(db, "e", "store-a", "sent_to_whatsapp");
    product(db, "p", "store-a", 4);
    item(db, "c", "p", "store-a", 1);
    item(db, "e", "p", "store-a", 2);
    assert.equal(stock(db, "p"), 1);
    db.exec(`UPDATE "Order" SET "status"='cancelled' WHERE "id"='c'`);
    assert.equal(stock(db, "p"), 2);
    db.exec(`UPDATE "Order" SET "status"='cancelled' WHERE "id"='c'`);
    assert.equal(stock(db, "p"), 2, "repeat cancel no-op");
    db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='e'`);
    assert.equal(stock(db, "p"), 4);
    db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='e'`);
    assert.equal(stock(db, "p"), 4, "repeat expiry no-op");
  } finally { db.close(); }
});

test("confirmed/shipped/delivered/cancelled cannot expire", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    for (const s of ["confirmed", "shipped", "delivered", "cancelled"]) insertOrder(db, s, "store-a", s);
    product(db, "p", "store-a", 1);
    for (const s of ["confirmed", "shipped", "delivered", "cancelled"]) {
      assert.throws(() => db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='${s}'`), /Only an unconfirmed order can expire/, s);
      assert.equal(status(db, s), s);
    }
    assert.equal(stock(db, "p"), 1);
  } finally { db.close(); }
});

test("expired and cancelled are terminal (no reopen, no re-cancel)", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    insertOrder(db, "e", "store-a", "sent_to_whatsapp");
    insertOrder(db, "c", "store-a", "confirmed");
    product(db, "p", "store-a", 2);
    item(db, "e", "p", "store-a", 1);
    item(db, "c", "p", "store-a", 1);
    db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='e'`);
    db.exec(`UPDATE "Order" SET "status"='cancelled' WHERE "id"='c'`);
    assert.throws(() => db.exec(`UPDATE "Order" SET "status"='confirmed' WHERE "id"='e'`), /cannot be reopened/);
    assert.throws(() => db.exec(`UPDATE "Order" SET "status"='confirmed' WHERE "id"='c'`), /cannot be reopened/);
    assert.equal(stock(db, "p"), 2, "no double restore on rejected reopens");
    assert.equal(status(db, "e"), "expired");
    assert.equal(status(db, "c"), "cancelled");
  } finally { db.close(); }
});

test("one child expiry does not affect a sibling vendor order", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    insertOrder(db, "a", "store-a", "sent_to_whatsapp");
    insertOrder(db, "b", "store-b", "sent_to_whatsapp");
    product(db, "pa", "store-a", 5);
    product(db, "pb", "store-b", 5);
    item(db, "a", "pa", "store-a", 2);
    item(db, "b", "pb", "store-b", 3);
    db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='b'`);
    assert.equal(status(db, "b"), "expired");
    assert.equal(status(db, "a"), "sent_to_whatsapp");
    assert.equal(stock(db, "pb"), 5);
    assert.equal(stock(db, "pa"), 3);
  } finally { db.close(); }
});

test("a new order after expiry requires a fresh stock check", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    insertOrder(db, "o", "store-a", "sent_to_whatsapp");
    product(db, "p", "store-a", 1);
    item(db, "o", "p", "store-a", 1);
    db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='o'`);
    assert.equal(stock(db, "p"), 1);
    insertOrder(db, "n", "store-a", "sent_to_whatsapp");
    item(db, "n", "p", "store-a", 1);
    assert.equal(stock(db, "p"), 0);
    insertOrder(db, "n2", "store-a", "sent_to_whatsapp");
    assert.throws(() => item(db, "n2", "p", "store-a", 1), /Insufficient stock/);
  } finally { db.close(); }
});

test("WhatsApp handoff timestamp is first-write-only", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    insertOrder(db, "o", "store-a", "sent_to_whatsapp");
    assert.equal(Number(db.prepare(CONTACT_OPENED).run("2025-01-01T00:00:00.000Z", "o").changes), 1);
    const first = db.prepare('SELECT "vendorContactOpenedAt" t FROM "Order" WHERE "id"=\'o\'').get().t;
    assert.equal(Number(db.prepare(CONTACT_OPENED).run("2026-06-06T00:00:00.000Z", "o").changes), 0);
    assert.equal(db.prepare('SELECT "vendorContactOpenedAt" t FROM "Order" WHERE "id"=\'o\'').get().t, first);
    assert.equal(status(db, "o"), "sent_to_whatsapp", "handoff never changes status");
  } finally { db.close(); }
});

test("paymentStatus does not alter expiry eligibility", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt","paymentStatus") VALUES ('o','store-a','sent_to_whatsapp','2026-01-01T00:00:00.000Z','paid')`);
    product(db, "p", "store-a", 1);
    item(db, "o", "p", "store-a", 1);
    db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='o'`);
    assert.equal(status(db, "o"), "expired");
    assert.equal(stock(db, "p"), 1);
  } finally { db.close(); }
});

test("forged store/order ids fail without side effects", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    insertOrder(db, "o", "store-a", "sent_to_whatsapp");
    product(db, "p", "store-a", 2);
    item(db, "o", "p", "store-a", 1);
    assert.equal(Number(db.prepare(VENDOR_CANCEL).run("other", "o", "store-b").changes), 0);
    assert.equal(Number(db.prepare(VENDOR_CANCEL).run("other", "does-not-exist", "store-a").changes), 0);
    assert.equal(status(db, "o"), "sent_to_whatsapp");
    assert.equal(stock(db, "p"), 1);
  } finally { db.close(); }
});

test("concurrent cancellation writes restore inventory once", async () => {
  const { directory, path } = tempDb();
  const db = new DatabaseSync(path);
  try {
    schema(db);
    insertOrder(db, "o", "store-a", "confirmed");
    product(db, "p", "store-a", 2);
    item(db, "o", "p", "store-a", 1);
    const cancel = `UPDATE "Order" SET "status"='cancelled' WHERE "id"=? AND "status" <> 'cancelled'`;
    const results = await Promise.all([runInWorker(path, cancel, ["o"]), runInWorker(path, cancel, ["o"])]);
    assert.deepEqual(results.map((r) => r.changes).sort(), [0, 1]);
    assert.equal(stock(db, "p"), 2, "seeded 2, reserved 1, restored once back to 2");
    assert.equal(status(db, "o"), "cancelled");
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
