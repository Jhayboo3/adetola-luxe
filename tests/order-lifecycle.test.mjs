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

// Exercises the real production migration 0019 against SQLite, plus 0012 for the
// cancellation restore. Proves the expiry/accept/cancel/handoff invariants with
// at-most-once stock restoration and compare-and-set races.

const cancelMigration = readFileSync(new URL("../prisma/migrations/0012_order_cancel_inventory_guard.sql", import.meta.url), "utf8");
const expiryMigration = readFileSync(new URL("../prisma/migrations/0019_order_expiry_lifecycle.sql", import.meta.url), "utf8");

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
      "createdAt" TEXT NOT NULL, "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
      "userId" TEXT
    );
    CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "stock" INTEGER NOT NULL, "updatedAt" TEXT);
    CREATE TABLE "OrderItem" ("orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "storeId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
  `);
  db.exec(inventoryGuard);
  db.exec(cancelMigration);
  db.exec(expiryMigration);
}

const EXPIRE = `UPDATE "Order" SET "status" = 'expired' WHERE "id" = ? AND "status" IN ('sent_to_whatsapp','pending') AND "createdAt" <= ?`;
const ACCEPT = `UPDATE "Order" SET "status" = 'confirmed', "acceptedAt" = COALESCE("acceptedAt", ?) WHERE "id" = ? AND "status" IN ('sent_to_whatsapp','pending') AND "createdAt" > ?`;
const CUSTOMER_CANCEL = `UPDATE "Order" SET "status" = 'cancelled' WHERE "id" = ? AND "userId" = ? AND "status" IN ('sent_to_whatsapp','pending')`;
const VENDOR_CANCEL = `UPDATE "Order" SET "status" = 'cancelled', "rejectionReason" = ? WHERE "id" = ? AND "storeId" = ? AND "status" IN ('sent_to_whatsapp','pending','confirmed')`;
const CONTACT_OPENED = `UPDATE "Order" SET "vendorContactOpenedAt" = ? WHERE "id" = ? AND "vendorContactOpenedAt" IS NULL`;
const CUTOFF = "2021-01-01T00:00:00.000Z";

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
  } finally {
    db.close();
  }
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
const stock = (db, id) => db.prepare('SELECT "stock" FROM "Product" WHERE "id" = ?').get(id).stock;
const status = (db, id) => db.prepare('SELECT "status" FROM "Order" WHERE "id" = ?').get(id).status;

// Pure predicate checks (fast, no DB).
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

test("3/6 repeated expiry restores stock exactly once", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('o','store-a','sent_to_whatsapp','2020-01-01T00:00:00.000Z')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',3,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',2)`);
    assert.equal(stock(db, "p"), 1);
    assert.equal(Number(db.prepare(EXPIRE).run("o", CUTOFF).changes), 1);
    assert.equal(stock(db, "p"), 3);
    assert.equal(Number(db.prepare(EXPIRE).run("o", CUTOFF).changes), 0);
    assert.equal(stock(db, "p"), 3, "repeat expiry no-op");
  } finally { db.close(); }
});

test("4/6 repeated customer cancel restores stock once", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt","userId") VALUES ('o','store-a','pending','2020-01-01T00:00:00.000Z','u1')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    assert.equal(Number(db.prepare(CUSTOMER_CANCEL).run("o", "u1").changes), 1);
    assert.equal(stock(db, "p"), 2);
    assert.equal(Number(db.prepare(CUSTOMER_CANCEL).run("o", "u1").changes), 0);
    assert.equal(stock(db, "p"), 2, "repeat cancel no-op");
  } finally { db.close(); }
});

test("7-10 confirmed/shipped/delivered/cancelled cannot expire", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    for (const s of ["confirmed", "shipped", "delivered", "cancelled"]) {
      db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('${s}','store-a','${s}','2020-01-01T00:00:00.000Z')`);
    }
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',1,NULL)`);
    for (const s of ["confirmed", "shipped", "delivered", "cancelled"]) {
      assert.throws(() => db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='${s}'`), /Only an unconfirmed order can expire/, s);
      assert.equal(status(db, s), s);
    }
    assert.equal(stock(db, "p"), 1, "no stock change for rejected expiries");
  } finally { db.close(); }
});

test("11/12 expired cannot reopen or be cancelled again", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt","userId") VALUES ('o','store-a','sent_to_whatsapp','2020-01-01T00:00:00.000Z','u1')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',1,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    assert.equal(Number(db.prepare(EXPIRE).run("o", CUTOFF).changes), 1);
    assert.equal(status(db, "o"), "expired");
    assert.equal(stock(db, "p"), 1, "reservation released once");
    assert.throws(() => db.exec(`UPDATE "Order" SET "status"='confirmed' WHERE "id"='o'`), /cannot be reopened/);
    // A customer cancellation attempt after expiry matches nothing (status-eligible guard).
    assert.equal(Number(db.prepare(CUSTOMER_CANCEL).run("o", "u1").changes), 0);
    assert.equal(status(db, "o"), "expired");
    assert.equal(stock(db, "p"), 1);
  } finally { db.close(); }
});

test("13 one child expiry does not affect a sibling vendor order", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('a','store-a','sent_to_whatsapp','2020-01-01T00:00:00.000Z'), ('b','store-b','sent_to_whatsapp','2020-01-01T00:00:00.000Z')`);
    db.exec(`INSERT INTO "Product" VALUES ('pa','store-a',5,NULL), ('pb','store-b',5,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('a','pa','store-a',2), ('b','pb','store-b',3)`);
    assert.equal(Number(db.prepare(EXPIRE).run("b", CUTOFF).changes), 1);
    assert.equal(status(db, "b"), "expired");
    assert.equal(status(db, "a"), "sent_to_whatsapp", "sibling untouched");
    assert.equal(stock(db, "pb"), 5, "store B restored");
    assert.equal(stock(db, "pa"), 3, "store A stays reserved");
  } finally { db.close(); }
});

test("14 new order after expiry requires a fresh stock check", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('o','store-a','sent_to_whatsapp','2020-01-01T00:00:00.000Z')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',1,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    assert.equal(Number(db.prepare(EXPIRE).run("o", CUTOFF).changes), 1);
    assert.equal(stock(db, "p"), 1, "released");
    // A fresh order reserves again...
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('n','store-a','sent_to_whatsapp','2026-01-01T00:00:00.000Z')`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('n','p','store-a',1)`);
    assert.equal(stock(db, "p"), 0);
    // ...and a second fresh order cannot oversell.
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('n2','store-a','sent_to_whatsapp','2026-01-01T00:00:00.000Z')`);
    assert.throws(() => db.exec(`INSERT INTO "OrderItem" VALUES ('n2','p','store-a',1)`), /Insufficient stock/);
  } finally { db.close(); }
});

test("15/16 WhatsApp click timestamp is first-write-only and does not extend expiry", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('o','store-a','sent_to_whatsapp','2020-01-01T00:00:00.000Z')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',1,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    assert.equal(Number(db.prepare(CONTACT_OPENED).run("2025-01-01T00:00:00.000Z", "o").changes), 1);
    const first = db.prepare('SELECT "vendorContactOpenedAt" FROM "Order" WHERE "id" = \'o\'').get().vendorContactOpenedAt;
    assert.equal(first, "2025-01-01T00:00:00.000Z");
    assert.equal(Number(db.prepare(CONTACT_OPENED).run("2026-06-06T00:00:00.000Z", "o").changes), 0, "second click is a no-op");
    assert.equal(db.prepare('SELECT "vendorContactOpenedAt" FROM "Order" WHERE "id" = \'o\'').get().vendorContactOpenedAt, first, "first click wins");
    // Expiry is driven by createdAt, not by the click.
    assert.equal(Number(db.prepare(EXPIRE).run("o", CUTOFF).changes), 1);
    assert.equal(status(db, "o"), "expired");
  } finally { db.close(); }
});

test("17 paymentStatus does not alter expiry eligibility", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt","paymentStatus") VALUES ('o','store-a','sent_to_whatsapp','2020-01-01T00:00:00.000Z','paid')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',1,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    assert.equal(Number(db.prepare(EXPIRE).run("o", CUTOFF).changes), 1, "unaccepted order expires even if vendor marked payment received");
    assert.equal(status(db, "o"), "expired");
    assert.equal(stock(db, "p"), 1);
  } finally { db.close(); }
});

test("18 forged store/order ids fail without side effects", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt","userId") VALUES ('o','store-a','sent_to_whatsapp','2020-01-01T00:00:00.000Z','u1')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    // Wrong store (another vendor), wrong customer, unknown id.
    assert.equal(Number(db.prepare(VENDOR_CANCEL).run("other", "o", "store-b").changes), 0);
    assert.equal(Number(db.prepare(CUSTOMER_CANCEL).run("o", "someone-else").changes), 0);
    assert.equal(Number(db.prepare(VENDOR_CANCEL).run("other", "does-not-exist", "store-a").changes), 0);
    assert.equal(status(db, "o"), "sent_to_whatsapp");
    assert.equal(stock(db, "p"), 1, "no stock change from forged ids");
  } finally { db.close(); }
});

test("1 expiry racing Accept: one winner, correct stock", async () => {
  for (let i = 0; i < 6; i++) {
    const { directory, path } = tempDb();
    const db = new DatabaseSync(path);
    try {
      schema(db);
      db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('o','store-a','sent_to_whatsapp','2026-06-01T00:00:00.000Z')`);
      db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
      db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
      // Active reservation: Accept wins, expiry is a no-op.
      await Promise.all([
        runInWorker(path, EXPIRE, ["o", CUTOFF]),
        runInWorker(path, ACCEPT, ["2026-06-01T01:00:00.000Z", "o", CUTOFF]),
      ]);
      const s = status(db, "o");
      assert.equal(s, "confirmed");
      assert.equal(stock(db, "p"), 1, "stock stays reserved");
    } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("2 expiry racing customer Cancel: one winner, restored once", async () => {
  for (let i = 0; i < 6; i++) {
    const { directory, path } = tempDb();
    const db = new DatabaseSync(path);
    try {
      schema(db);
      db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt","userId") VALUES ('o','store-a','pending','2020-01-01T00:00:00.000Z','u1')`);
      db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
      db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
      await Promise.all([
        runInWorker(path, EXPIRE, ["o", CUTOFF]),
        runInWorker(path, CUSTOMER_CANCEL, ["o", "u1"]),
      ]);
      const s = status(db, "o");
      assert.ok(["cancelled", "expired"].includes(s), `status ${s}`);
      assert.equal(stock(db, "p"), 2, "restored exactly once regardless of winner");
    } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("5 simultaneous vendor actions apply once", async () => {
  const { directory, path } = tempDb();
  const db = new DatabaseSync(path);
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('o','store-a','sent_to_whatsapp','2026-06-01T00:00:00.000Z')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    const results = await Promise.all([
      runInWorker(path, ACCEPT, ["2026-06-01T01:00:00.000Z", "o", CUTOFF]),
      runInWorker(path, ACCEPT, ["2026-06-01T01:00:00.000Z", "o", CUTOFF]),
    ]);
    assert.deepEqual(results.map((r) => r.changes).sort(), [0, 1]);
    assert.equal(status(db, "o"), "confirmed");
    assert.equal(stock(db, "p"), 1, "accept leaves stock reserved");
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
