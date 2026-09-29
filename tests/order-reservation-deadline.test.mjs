import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { Worker } from "node:worker_threads";
import {
  ORDER_RESERVATION_WINDOW_HOURS,
  isReservationActive,
  reservationCutoffIso,
  reservationDeadlineMs,
  reservationWindowHours,
} from "../src/lib/reservation.ts";

// Verifies the reservation-deadline invariant: acceptance/rejection/cancellation
// are valid only while the reservation is still active, independently of whether
// the opportunistic sweep has run. Mirrors the exact SQL used by the actions.

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
      "createdAt" TEXT NOT NULL, "updatedAt" TEXT, "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
      "userId" TEXT
    );
    CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "stock" INTEGER NOT NULL, "updatedAt" TEXT);
    CREATE TABLE "OrderItem" ("orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "storeId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
  `);
  db.exec(inventoryGuard);
  db.exec(cancelMigration);
  db.exec(expiryMigration);
}

// --- Exact action SQL (deadline-guarded) ---
const ACCEPT = `UPDATE "Order" SET "status"='confirmed', "acceptedAt"=COALESCE("acceptedAt", ?), "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=? AND "storeId"=? AND "status" IN ('sent_to_whatsapp','pending') AND "createdAt" > ?`;
const CUSTOMER_CANCEL = `UPDATE "Order" SET "status"='cancelled', "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=? AND "userId"=? AND "status" IN ('sent_to_whatsapp','pending') AND "createdAt" > ?`;
const VENDOR_REJECT = `UPDATE "Order" SET "status"='cancelled', "rejectionReason"=?, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=? AND "storeId"=? AND "status" IN ('sent_to_whatsapp','pending','confirmed') AND ("status"='confirmed' OR "createdAt" > ?)`;
const EXPIRE_ONE = `UPDATE "Order" SET "status"='expired', "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=? AND "storeId"=? AND "status" IN ('sent_to_whatsapp','pending') AND "createdAt" <= ?`;

const NOW = Date.parse("2026-01-01T12:00:00.000Z");
const CUTOFF = reservationCutoffIso(NOW, ORDER_RESERVATION_WINDOW_HOURS); // 2026-01-01T00:00:00.000Z
const ACTIVE = "2026-01-01T06:00:00.000Z";   // > cutoff
const STALE = "2025-12-31T23:00:00.000Z";    // <= cutoff
const JUST_ACTIVE = "2026-01-01T00:00:00.001Z"; // 1ms before/after boundary -> active
const AT_BOUNDARY = CUTOFF;                   // exactly the deadline -> stale

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
  const directory = mkdtempSync(join(tmpdir(), "larkvine-deadline-"));
  return { directory, path: join(directory, "orders.sqlite") };
}
const stock = (db, id) => db.prepare('SELECT "stock" FROM "Product" WHERE "id"=?').get(id).stock;
const status = (db, id) => db.prepare('SELECT "status" FROM "Order" WHERE "id"=?').get(id).status;
const stat = (db, id) => db.prepare('SELECT "status" s, "rejectionReason" r, "acceptedAt" a FROM "Order" WHERE "id"=?').get(id);

test("action SQL enforces the reservation deadline and authoritative expiry", () => {
  const admin = readFileSync(new URL("../src/app/admin/(store)/orders/actions.ts", import.meta.url), "utf8");
  const account = readFileSync(new URL("../src/app/account/orders/actions.ts", import.meta.url), "utf8");
  const accept = admin.slice(admin.indexOf("export async function acceptOrder"), admin.indexOf("export async function rejectOrder"));
  const reject = admin.slice(admin.indexOf("export async function rejectOrder"));
  assert.match(accept, /"createdAt" > \?/, "acceptOrder must require createdAt > cutoff");
  assert.match(accept, /expireOrderIfStale/, "acceptOrder must expire stale orders authoritatively");
  assert.match(reject, /"createdAt" > \?/, "rejectOrder must require createdAt > cutoff for unaccepted orders");
  assert.match(account, /"createdAt" > \?/, "cancelOwnOrder must require createdAt > cutoff");
  assert.match(account, /expireOrderIfStale/, "cancelOwnOrder must expire stale orders authoritatively");
});

test("reservation window is centrally configurable", () => {
  assert.equal(ORDER_RESERVATION_WINDOW_HOURS, 12);
  assert.equal(reservationWindowHours(undefined), 12);
  assert.equal(reservationWindowHours(""), 12);
  assert.equal(reservationWindowHours("24"), 24);
  assert.equal(reservationWindowHours("0"), 12);
  assert.equal(reservationWindowHours("-5"), 12);
  assert.equal(reservationDeadlineMs(Date.parse(ACTIVE), 12), Date.parse(ACTIVE) + 12 * 3_600_000);
  assert.equal(isReservationActive(Date.parse(ACTIVE), NOW, 12), true);
  assert.equal(isReservationActive(Date.parse(STALE), NOW, 12), false);
  assert.equal(isReservationActive(Date.parse(AT_BOUNDARY), NOW, 12), false, "exactly at the deadline is not active");
});

test("stale unswept Accept cannot confirm; it expires and restores stock once", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('o','store-a','sent_to_whatsapp','${STALE}')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    // Accept attempt after the deadline but before any sweep: must not confirm.
    assert.equal(Number(db.prepare(ACCEPT).run("2026-01-15T00:00:00.000Z", "o", "store-a", CUTOFF).changes), 0);
    assert.equal(status(db, "o"), "sent_to_whatsapp", "stays unconfirmed");
    // Authoritative expiry (the action's fallback).
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("o", "store-a", CUTOFF).changes), 1);
    assert.equal(status(db, "o"), "expired");
    assert.equal(stock(db, "p"), 2, "stock restored once");
    // Repeated stale accept is a no-op with no further stock change.
    assert.equal(Number(db.prepare(ACCEPT).run("2026-01-15T00:00:00.000Z", "o", "store-a", CUTOFF).changes), 0);
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("o", "store-a", CUTOFF).changes), 0);
    assert.equal(stock(db, "p"), 2);
  } finally { db.close(); }
});

test("Accept boundary: strictly before the deadline succeeds, at/after fails", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('just','store-a','sent_to_whatsapp','${JUST_ACTIVE}'), ('edge','store-a','sent_to_whatsapp','${AT_BOUNDARY}')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',5,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('just','p','store-a',1), ('edge','p','store-a',1)`);
    assert.equal(Number(db.prepare(ACCEPT).run("2026-01-15T00:00:00.000Z", "just", "store-a", CUTOFF).changes), 1, "1ms inside the window accepts");
    assert.equal(stat(db, "just").s, "confirmed");
    assert.equal(Number(db.prepare(ACCEPT).run("2026-01-15T00:00:00.000Z", "edge", "store-a", CUTOFF).changes), 0, "exactly at the deadline cannot accept");
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("edge", "store-a", CUTOFF).changes), 1);
    assert.equal(status(db, "edge"), "expired");
  } finally { db.close(); }
});

test("stale unswept customer Cancel expires (not cancels), stock once", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt","userId") VALUES ('o','store-a','pending','${STALE}','u1')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    assert.equal(Number(db.prepare(CUSTOMER_CANCEL).run("o", "u1", CUTOFF).changes), 0, "late cancel blocked");
    assert.equal(status(db, "o"), "pending");
    // Owner-scoped authoritative expiry.
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("o", "store-a", CUTOFF).changes), 1);
    assert.equal(status(db, "o"), "expired", "terminal state is expired, not cancelled");
    assert.equal(stock(db, "p"), 2);
  } finally { db.close(); }
});

test("stale unswept vendor Reject expires (not cancels); confirmed orders remain cancellable", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('stale','store-a','sent_to_whatsapp','${STALE}'), ('conf','store-a','confirmed','${STALE}')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',3,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('stale','p','store-a',1), ('conf','p','store-a',1)`);
    // Late reject of an unaccepted stale order is blocked and expires instead.
    assert.equal(Number(db.prepare(VENDOR_REJECT).run("out_of_stock", "stale", "store-a", CUTOFF).changes), 0);
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("stale", "store-a", CUTOFF).changes), 1);
    assert.equal(status(db, "stale"), "expired");
    // A confirmed order has no reservation deadline and can still be cancelled.
    assert.equal(Number(db.prepare(VENDOR_REJECT).run("customer_requested", "conf", "store-a", CUTOFF).changes), 1);
    assert.equal(status(db, "conf"), "cancelled");
    assert.equal(stat(db, "conf").r, "customer_requested");
    assert.equal(stock(db, "p"), 3, "both restorations happened exactly once");
  } finally { db.close(); }
});

test("active Accept succeeds and confirmed orders cannot expire or reopen", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('o','store-a','sent_to_whatsapp','${ACTIVE}')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    assert.equal(Number(db.prepare(ACCEPT).run("2026-01-15T00:00:00.000Z", "o", "store-a", CUTOFF).changes), 1);
    assert.equal(status(db, "o"), "confirmed");
    assert.equal(stock(db, "p"), 1, "accept leaves stock reserved");
    assert.throws(() => db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='o'`), /Only an unconfirmed order can expire/);
    assert.equal(status(db, "o"), "confirmed");
  } finally { db.close(); }
});

test("Accept vs expiry: exactly one outcome, stock restored once", async () => {
  // Active order -> Accept wins, expiry no-op.
  {
    const { directory, path } = tempDb();
    const db = new DatabaseSync(path);
    try {
      schema(db);
      db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('o','store-a','sent_to_whatsapp','${ACTIVE}')`);
      db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
      db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
      const [accept, expire] = await Promise.all([
        runInWorker(path, ACCEPT, ["2026-01-15T00:00:00.000Z", "o", "store-a", CUTOFF]),
        runInWorker(path, EXPIRE_ONE, ["o", "store-a", CUTOFF]),
      ]);
      assert.equal(accept.changes, 1);
      assert.equal(expire.changes, 0);
      assert.equal(status(db, "o"), "confirmed");
      assert.equal(stock(db, "p"), 1);
    } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
  }
  // Stale order -> expiry wins, Accept no-op.
  {
    const { directory, path } = tempDb();
    const db = new DatabaseSync(path);
    try {
      schema(db);
      db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('o','store-a','pending','${STALE}')`);
      db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
      db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
      const [accept, expire] = await Promise.all([
        runInWorker(path, ACCEPT, ["2026-01-15T00:00:00.000Z", "o", "store-a", CUTOFF]),
        runInWorker(path, EXPIRE_ONE, ["o", "store-a", CUTOFF]),
      ]);
      assert.equal(accept.changes, 0);
      assert.equal(expire.changes, 1);
      assert.equal(status(db, "o"), "expired");
      assert.equal(stock(db, "p"), 2, "restored once");
    } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("a delayed sweep never extends the reservation lifetime", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt") VALUES ('o','store-a','sent_to_whatsapp','${STALE}')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    // No sweep has run. A later Accept still cannot confirm because the deadline
    // is evaluated at action time, not when the sweep last ran.
    assert.equal(Number(db.prepare(ACCEPT).run("2026-01-15T00:00:00.000Z", "o", "store-a", CUTOFF).changes), 0);
    assert.equal(status(db, "o"), "sent_to_whatsapp");
    assert.equal(stock(db, "p"), 1);
  } finally { db.close(); }
});
