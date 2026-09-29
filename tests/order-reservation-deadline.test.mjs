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
  reservationExpiresAtIso,
  reservationWindowHours,
} from "../src/lib/reservation.ts";

// Reservation-deadline + stock-availability invariants, against the real
// migrations 0012 + 0019 + 0020 and the exact SQL used by the actions, the
// targeted checkout cleanup and the sweep.

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

// --- Exact SQL mirrored from application code ---
const ACCEPT = `UPDATE "Order" SET "status"='confirmed', "acceptedAt"=COALESCE("acceptedAt", ?), "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=? AND "storeId"=? AND "status" IN ('sent_to_whatsapp','pending') AND ("reservationExpiresAt" IS NULL OR "reservationExpiresAt" > ?)`;
const CUSTOMER_CANCEL = `UPDATE "Order" SET "status"='cancelled', "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=? AND "userId"=? AND "status" IN ('sent_to_whatsapp','pending') AND ("reservationExpiresAt" IS NULL OR "reservationExpiresAt" > ?)`;
const VENDOR_REJECT = `UPDATE "Order" SET "status"='cancelled', "rejectionReason"=?, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=? AND "storeId"=? AND "status" IN ('sent_to_whatsapp','pending','confirmed') AND ("status"='confirmed' OR "reservationExpiresAt" IS NULL OR "reservationExpiresAt" > ?)`;
const EXPIRE_ONE = `UPDATE "Order" SET "status"='expired', "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=? AND "storeId"=? AND "status" IN ('sent_to_whatsapp','pending') AND "reservationExpiresAt" IS NOT NULL AND "reservationExpiresAt" <= ?`;
const TARGETED = `SELECT DISTINCT o."id" AS id FROM "OrderItem" i JOIN "Order" o ON o."id"=i."orderId" WHERE i."productId" IN (?) AND o."status" IN ('sent_to_whatsapp','pending') AND o."reservationExpiresAt" IS NOT NULL AND o."reservationExpiresAt" <= ?`;

const NOW = "2026-01-01T12:00:00.000Z";
const ACTIVE = "2026-01-02T00:00:00.000Z";   // future deadline
const STALE = "2026-01-01T00:00:00.000Z";    // past deadline
const JUST_ACTIVE = "2026-01-01T12:00:00.001Z"; // 1ms after now

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
const insertOrder = (db, id, storeId, st, deadline, userId = null) =>
  db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt","updatedAt","reservationExpiresAt","userId") VALUES ('${id}','${storeId}','${st}','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z',${deadline ? `'${deadline}'` : "NULL"},${userId ? `'${userId}'` : "NULL"})`);
const item = (db, orderId, productId, storeId, quantity) =>
  db.exec(`INSERT INTO "OrderItem" ("orderId","productId","storeId","quantity") VALUES ('${orderId}','${productId}','${storeId}',${quantity})`);
const product = (db, id, storeId, st) => db.exec(`INSERT INTO "Product" ("id","storeId","stock","updatedAt") VALUES ('${id}','${storeId}',${st},NULL)`);

test("reservation window is centrally configurable and deadlines persist per order", () => {
  assert.equal(ORDER_RESERVATION_WINDOW_HOURS, 12);
  assert.equal(reservationWindowHours(undefined), 12);
  assert.equal(reservationWindowHours("6"), 6);
  assert.equal(reservationWindowHours("24"), 24);
  assert.equal(reservationWindowHours("0"), 12);
  const created = Date.parse("2026-01-01T00:00:00.000Z");
  assert.equal(reservationExpiresAtIso(created, 12), "2026-01-01T12:00:00.000Z");
  assert.equal(reservationExpiresAtIso(created, 6), "2026-01-01T06:00:00.000Z");
  // A persisted deadline is stable regardless of the current config.
  assert.equal(isReservationActive("2026-01-01T12:00:00.000Z", Date.parse("2026-01-01T11:59:59.999Z")), true);
  assert.equal(isReservationActive("2026-01-01T12:00:00.000Z", Date.parse("2026-01-01T12:00:00.000Z")), false, "equality is expired");
  assert.equal(isReservationActive(null, Date.parse("2030-01-01T00:00:00.000Z")), true, "grandfathered NULL is live");
});

test("grandfathered (NULL deadline) orders are never auto-expired", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    insertOrder(db, "o", "store-a", "sent_to_whatsapp", null);
    product(db, "p", "store-a", 1);
    item(db, "o", "p", "store-a", 1);
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("o", "store-a", NOW).changes), 0);
    assert.equal(status(db, "o"), "sent_to_whatsapp");
    assert.equal(Number(db.prepare(ACCEPT).run(NOW, "o", "store-a", NOW).changes), 1, "grandfathered order can be accepted");
    assert.equal(status(db, "o"), "confirmed");
  } finally { db.close(); }
});

test("stale unswept Accept cannot confirm; it expires and restores stock once", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    insertOrder(db, "o", "store-a", "sent_to_whatsapp", STALE);
    product(db, "p", "store-a", 1);
    item(db, "o", "p", "store-a", 1);
    assert.equal(Number(db.prepare(ACCEPT).run(NOW, "o", "store-a", NOW).changes), 0);
    assert.equal(status(db, "o"), "sent_to_whatsapp");
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("o", "store-a", NOW).changes), 1);
    assert.equal(status(db, "o"), "expired");
    assert.equal(stock(db, "p"), 1, "released once");
    assert.equal(Number(db.prepare(ACCEPT).run(NOW, "o", "store-a", NOW).changes), 0);
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("o", "store-a", NOW).changes), 0);
    assert.equal(stock(db, "p"), 1);
  } finally { db.close(); }
});

test("Accept boundary: strictly before deadline succeeds, at deadline fails and expires", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    insertOrder(db, "just", "store-a", "sent_to_whatsapp", JUST_ACTIVE);
    insertOrder(db, "edge", "store-a", "sent_to_whatsapp", NOW);
    product(db, "p", "store-a", 2);
    item(db, "just", "p", "store-a", 1);
    item(db, "edge", "p", "store-a", 1);
    assert.equal(Number(db.prepare(ACCEPT).run(NOW, "just", "store-a", NOW).changes), 1);
    assert.equal(Number(db.prepare(ACCEPT).run(NOW, "edge", "store-a", NOW).changes), 0);
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("edge", "store-a", NOW).changes), 1);
    assert.equal(status(db, "edge"), "expired");
  } finally { db.close(); }
});

test("stale customer Cancel / vendor Reject expire instead of cancelling", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    insertOrder(db, "c", "store-a", "pending", STALE, "u1");
    insertOrder(db, "r", "store-a", "sent_to_whatsapp", STALE);
    insertOrder(db, "conf", "store-a", "confirmed", STALE);
    product(db, "p", "store-a", 3);
    item(db, "c", "p", "store-a", 1);
    item(db, "r", "p", "store-a", 1);
    item(db, "conf", "p", "store-a", 1);
    assert.equal(Number(db.prepare(CUSTOMER_CANCEL).run("c", "u1", NOW).changes), 0);
    assert.equal(Number(db.prepare(VENDOR_REJECT).run("out_of_stock", "r", "store-a", NOW).changes), 0);
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("c", "store-a", NOW).changes), 1);
    assert.equal(Number(db.prepare(EXPIRE_ONE).run("r", "store-a", NOW).changes), 1);
    assert.equal(status(db, "c"), "expired");
    assert.equal(status(db, "r"), "expired");
    // Confirmed order has no reservation deadline; still cancellable.
    assert.equal(Number(db.prepare(VENDOR_REJECT).run("customer_requested", "conf", "store-a", NOW).changes), 1);
    assert.equal(status(db, "conf"), "cancelled");
    assert.equal(stock(db, "p"), 3, "each restoration happened once");
  } finally { db.close(); }
});

test("SCENARIO A: a stale unswept last-unit reservation is restored by targeted cleanup before a new checkout", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    product(db, "p", "store-a", 1);
    insertOrder(db, "a", "store-a", "sent_to_whatsapp", STALE);
    item(db, "a", "p", "store-a", 1);
    assert.equal(stock(db, "p"), 0, "Customer A holds the last unit");
    // No sweep, no Accept/Cancel/Reject. Targeted cleanup for Product p:
    const candidates = db.prepare(TARGETED).all("p", NOW);
    assert.equal(candidates.length, 1);
    for (const row of candidates) db.prepare(EXPIRE_ONE).run(row.id, "store-a", NOW);
    assert.equal(stock(db, "p"), 1, "stale reservation released before stock validation");
    assert.equal(status(db, "a"), "expired");
    // Customer B can now reserve the restored unit.
    insertOrder(db, "b", "store-a", "sent_to_whatsapp", ACTIVE);
    item(db, "b", "p", "store-a", 1);
    assert.equal(stock(db, "p"), 0);
    assert.equal(status(db, "b"), "sent_to_whatsapp");
  } finally { db.close(); }
});

test("SCENARIO B: targeted cleanup is idempotent and restores once", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    product(db, "p", "store-a", 1);
    insertOrder(db, "a", "store-a", "pending", STALE);
    item(db, "a", "p", "store-a", 1);
    const candidates = db.prepare(TARGETED).all("p", NOW);
    for (const row of candidates) db.prepare(EXPIRE_ONE).run(row.id, "store-a", NOW);
    assert.equal(stock(db, "p"), 1);
    const again = db.prepare(TARGETED).all("p", NOW);
    assert.equal(again.length, 0, "no candidates remain");
    assert.equal(stock(db, "p"), 1);
  } finally { db.close(); }
});

test("only the stale child order expires; sibling vendor and other products are untouched", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    // Checkout: Vendor 1 / Product X (stale) and Vendor 2 / Product Y (active).
    product(db, "x", "store-1", 2);
    product(db, "y", "store-2", 2);
    insertOrder(db, "v1", "store-1", "sent_to_whatsapp", STALE);
    insertOrder(db, "v2", "store-2", "sent_to_whatsapp", ACTIVE);
    item(db, "v1", "x", "store-1", 1);
    item(db, "v2", "y", "store-2", 1);
    const candidates = db.prepare(TARGETED).all("x", NOW);
    assert.deepEqual(candidates.map((r) => r.id), ["v1"]);
    for (const row of candidates) db.prepare(EXPIRE_ONE).run(row.id, "store-1", NOW);
    assert.equal(status(db, "v1"), "expired");
    assert.equal(status(db, "v2"), "sent_to_whatsapp", "sibling untouched");
    assert.equal(stock(db, "x"), 2);
    assert.equal(stock(db, "y"), 1);
  } finally { db.close(); }
});

test("a multi-item stale child order restores all its reserved quantities once", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    product(db, "p1", "store-1", 2);
    product(db, "p2", "store-1", 5);
    insertOrder(db, "o", "store-1", "sent_to_whatsapp", STALE);
    item(db, "o", "p1", "store-1", 2);
    item(db, "o", "p2", "store-1", 3);
    // Triggered by product p1 only; the whole child order expires.
    const candidates = db.prepare(TARGETED).all("p1", NOW);
    assert.deepEqual(candidates.map((r) => r.id), ["o"]);
    for (const row of candidates) db.prepare(EXPIRE_ONE).run(row.id, "store-1", NOW);
    assert.equal(status(db, "o"), "expired");
    assert.equal(stock(db, "p1"), 2, "p1 restored once");
    assert.equal(stock(db, "p2"), 5, "p2 restored once too");
  } finally { db.close(); }
});

test("exactly one of two concurrent new buyers gets the restored last unit", async () => {
  const { directory, path } = tempDb();
  const db = new DatabaseSync(path);
  try {
    schema(db);
    product(db, "p", "store-a", 1);
    insertOrder(db, "a", "store-a", "sent_to_whatsapp", STALE);
    item(db, "a", "p", "store-a", 1);
    assert.equal(stock(db, "p"), 0);
    // Targeted cleanup releases the unit.
    for (const row of db.prepare(TARGETED).all("p", NOW)) db.prepare(EXPIRE_ONE).run(row.id, "store-a", NOW);
    assert.equal(stock(db, "p"), 1);
    // Two new orders race for the single restored unit.
    db.exec(`INSERT INTO "Order" ("id","storeId","status","createdAt","updatedAt","reservationExpiresAt") VALUES ('b1','store-a','sent_to_whatsapp','2026-01-01T12:00:00.000Z','2026-01-01T12:00:00.000Z','${ACTIVE}'), ('b2','store-a','sent_to_whatsapp','2026-01-01T12:00:00.000Z','2026-01-01T12:00:00.000Z','${ACTIVE}')`);
    const insertItem = `INSERT INTO "OrderItem" ("orderId","productId","storeId","quantity") VALUES (?,?,?,1)`;
    const results = await Promise.allSettled([
      runInWorker(path, insertItem, ["b1", "p", "store-a"]),
      runInWorker(path, insertItem, ["b2", "p", "store-a"]),
    ]);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    assert.equal(succeeded, 1, "exactly one buyer gets the last unit");
    assert.equal(stock(db, "p"), 0, "no negative inventory");
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("targeted cleanup racing the general sweep restores stock exactly once", async () => {
  const { directory, path } = tempDb();
  const db = new DatabaseSync(path);
  try {
    schema(db);
    product(db, "p", "store-a", 1);
    insertOrder(db, "a", "store-a", "sent_to_whatsapp", STALE);
    item(db, "a", "p", "store-a", 1);
    const sweepExpire = `UPDATE "Order" SET "status"='expired', "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=? AND "status" IN ('sent_to_whatsapp','pending') AND "reservationExpiresAt" IS NOT NULL AND "reservationExpiresAt" <= ?`;
    await Promise.all([
      runInWorker(path, EXPIRE_ONE, ["a", "store-a", NOW]),
      runInWorker(path, sweepExpire, ["a", NOW]),
    ]);
    assert.equal(status(db, "a"), "expired");
    assert.equal(stock(db, "p"), 1, "restored once despite two racing expire writers");
    await runInWorker(path, EXPIRE_ONE, ["a", "store-a", NOW]);
    assert.equal(stock(db, "p"), 1);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("actions enforce the persisted reservation deadline", () => {
  const admin = readFileSync(new URL("../src/app/admin/(store)/orders/actions.ts", import.meta.url), "utf8");
  const account = readFileSync(new URL("../src/app/account/orders/actions.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/app/api/orders/route.ts", import.meta.url), "utf8");
  assert.match(admin, /"reservationExpiresAt" > \?/, "accept/reject must use the persisted deadline");
  assert.match(account, /"reservationExpiresAt" > \?/, "cancel must use the persisted deadline");
  assert.match(route, /expireStaleReservationsForProducts/, "checkout must run targeted cleanup before stock validation");
  assert.match(route, /reservationExpiresAtIso/, "checkout must persist the deadline");
});
