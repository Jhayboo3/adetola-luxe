import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { Worker } from "node:worker_threads";

// DESIGN VALIDATION for the proposed automatic-expiry model in
// docs/ORDER-LIFECYCLE.md. This does NOT ship a production migration and does
// not alter the live schema; it proves the proposed triggers and sweep are
// atomic, idempotent and at-most-once before any owner approval.

const cancelMigration = readFileSync(new URL("../prisma/migrations/0012_order_cancel_inventory_guard.sql", import.meta.url), "utf8");

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

// Proposed (DRAFT) expiry triggers — verbatim from docs/ORDER-LIFECYCLE.md.
const expiryMigration = `
  CREATE TRIGGER "Order_expire_restore_stock"
  AFTER UPDATE OF "status" ON "Order"
  WHEN NEW."status" = 'expired' AND OLD."status" <> 'expired'
  BEGIN
    UPDATE "Product"
    SET "stock" = "stock" + (
      SELECT COALESCE(SUM("quantity"),0) FROM "OrderItem"
      WHERE "orderId" = NEW."id" AND "productId" = "Product"."id"
    ), "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" IN (SELECT "productId" FROM "OrderItem" WHERE "orderId" = NEW."id")
      AND "storeId" = NEW."storeId";
  END;

  CREATE TRIGGER "Order_expire_scope_guard"
  BEFORE UPDATE OF "status" ON "Order"
  WHEN NEW."status" = 'expired' AND OLD."status" <> 'expired' AND OLD."status" NOT IN ('sent_to_whatsapp','pending')
  BEGIN
    SELECT RAISE(ABORT, 'Only an unconfirmed order can expire');
  END;

  CREATE TRIGGER "Order_expired_reopen_guard"
  BEFORE UPDATE OF "status" ON "Order"
  WHEN OLD."status" = 'expired' AND NEW."status" <> 'expired'
  BEGIN
    SELECT RAISE(ABORT, 'Expired order cannot be reopened');
  END;
`;

function schema(db) {
  db.exec(`
    CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "status" TEXT NOT NULL, "createdAt" TEXT NOT NULL);
    CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "stock" INTEGER NOT NULL, "updatedAt" TEXT);
    CREATE TABLE "OrderItem" ("orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "storeId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
  `);
  db.exec(inventoryGuard);
  db.exec(cancelMigration);
  db.exec(expiryMigration);
}

const sweepSql = `UPDATE "Order" SET "status" = 'expired' WHERE "id" = ? AND "status" IN ('sent_to_whatsapp','pending') AND "createdAt" < ?`;
const acceptSql = `UPDATE "Order" SET "status" = 'confirmed' WHERE "id" = ? AND "status" = ?`;

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

function runInWorker(path, sql, params) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerSource, { eval: true, workerData: { path, sql, params } });
    worker.once("message", (result) => result.error ? reject(new Error(result.error)) : resolve(result));
    worker.once("error", reject);
    worker.once("exit", (code) => { if (code !== 0) reject(new Error(`worker exited ${code}`)); });
  });
}

function tempDb() {
  const directory = mkdtempSync(join(tmpdir(), "larkvine-expiry-test-"));
  return { directory, path: join(directory, "orders.sqlite") };
}

test("expiry restores stock exactly once and expired orders stay closed", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" VALUES ('o','store-a','sent_to_whatsapp','2020-01-01T00:00:00Z'), ('c','store-a','confirmed','2020-01-01T00:00:00Z')`);
    // Stock is decremented by the inventory guard when these reservation rows
    // are inserted, so `p` is 0 after both reservations (2 + 1 from stock 3).
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',3,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',2), ('c','p','store-a',1)`);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock, 0);

    db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='o'`);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock, 2, "expiry restores only its own item quantity");
    db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='o'`);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock, 2, "repeat expiry does not double-restore");
    assert.throws(() => db.exec(`UPDATE "Order" SET "status"='confirmed' WHERE "id"='o'`), /cannot be reopened/);
  } finally { db.close(); }
});

test("only unconfirmed orders can expire", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" VALUES ('conf','store-a','confirmed','2020-01-01T00:00:00Z'), ('ship','store-a','shipped','2020-01-01T00:00:00Z'), ('done','store-a','delivered','2020-01-01T00:00:00Z')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',1,NULL)`);
    for (const id of ["conf", "ship", "done"]) {
      assert.throws(() => db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='${id}'`), /Only an unconfirmed order can expire/);
    }
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock, 1);
  } finally { db.close(); }
});

test("expired order cannot be reopened (fresh stock validation required)", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" VALUES ('o','store-a','sent_to_whatsapp','2020-01-01T00:00:00Z')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',1,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='o'`);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock, 1, "reservation released");
    assert.throws(() => db.exec(`UPDATE "Order" SET "status"='confirmed' WHERE "id"='o'`), /cannot be reopened/);
    // A brand new order must still pass the inventory guard.
    db.exec(`INSERT INTO "Order" VALUES ('n','store-a','sent_to_whatsapp','2020-01-01T00:00:00Z')`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('n','p','store-a',1)`);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock, 0);
    db.exec(`INSERT INTO "Order" VALUES ('n2','store-a','sent_to_whatsapp','2020-01-01T00:00:00Z')`);
    assert.throws(() => db.exec(`INSERT INTO "OrderItem" VALUES ('n2','p','store-a',1)`), /Insufficient stock/);
  } finally { db.close(); }
});

test("sweep is idempotent across repeated runs", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" VALUES ('o','store-a','pending','2020-01-01T00:00:00Z')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock, 1);
    const cutoff = "2021-01-01T00:00:00Z";
    const first = db.prepare(sweepSql).run("o", cutoff);
    const second = db.prepare(sweepSql).run("o", cutoff);
    assert.equal(Number(first.changes), 1);
    assert.equal(Number(second.changes), 0);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock, 2);
  } finally { db.close(); }
});

test("one child order expiry does not affect another vendor's order", () => {
  const db = new DatabaseSync(":memory:");
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" VALUES ('a','store-a','sent_to_whatsapp','2020-01-01T00:00:00Z'), ('b','store-b','sent_to_whatsapp','2020-01-01T00:00:00Z')`);
    db.exec(`INSERT INTO "Product" VALUES ('pa','store-a',5,NULL), ('pb','store-b',5,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('a','pa','store-a',2), ('b','pb','store-b',3)`);
    db.exec(`UPDATE "Order" SET "status"='expired' WHERE "id"='b'`);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='pb'`).get().stock, 5, "store B restored to pre-reservation level");
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='pa'`).get().stock, 3, "store A reservation untouched");
    assert.equal(db.prepare(`SELECT "status" FROM "Order" WHERE "id"='a'`).get().status, "sent_to_whatsapp");
  } finally { db.close(); }
});

test("expiry racing vendor acceptance leaves one winner and correct stock", async () => {
  for (let iteration = 0; iteration < 5; iteration++) {
    const { directory, path } = tempDb();
    const db = new DatabaseSync(path);
    try {
      schema(db);
      db.exec(`INSERT INTO "Order" VALUES ('o','store-a','sent_to_whatsapp','2020-01-01T00:00:00Z')`);
      db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
      db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);

      await Promise.all([
        runInWorker(path, sweepSql, ["o", "2021-01-01T00:00:00Z"]),
        runInWorker(path, acceptSql, ["o", "sent_to_whatsapp"]),
      ]);
      const status = db.prepare(`SELECT "status" FROM "Order" WHERE "id"='o'`).get().status;
      const stock = db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock;
      assert.ok(["confirmed", "expired"].includes(status), `unexpected status ${status}`);
      // Seeded stock 2, one reservation -> 1. Expiry restores +1 -> 2; confirm leaves 1.
      assert.equal(stock, status === "expired" ? 2 : 1, `stock wrong for ${status}`);
    } finally {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("expiry racing customer cancellation restores stock exactly once", async () => {
  for (let iteration = 0; iteration < 5; iteration++) {
    const { directory, path } = tempDb();
    const db = new DatabaseSync(path);
    try {
      schema(db);
      db.exec(`INSERT INTO "Order" VALUES ('o','store-a','pending','2020-01-01T00:00:00Z')`);
      db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
      db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);

      const cancelSql = `UPDATE "Order" SET "status"='cancelled' WHERE "id"=? AND "status" IN ('sent_to_whatsapp','pending')`;
      await Promise.all([
        runInWorker(path, sweepSql, ["o", "2021-01-01T00:00:00Z"]),
        runInWorker(path, cancelSql, ["o"]),
      ]);
      const status = db.prepare(`SELECT "status" FROM "Order" WHERE "id"='o'`).get().status;
      const stock = db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock;
      assert.ok(["cancelled", "expired"].includes(status), `unexpected status ${status}`);
      assert.equal(stock, 2, "restored exactly once regardless of winner");
    } finally {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("two concurrent vendor acceptance actions apply once", async () => {
  const { directory, path } = tempDb();
  const db = new DatabaseSync(path);
  try {
    schema(db);
    db.exec(`INSERT INTO "Order" VALUES ('o','store-a','sent_to_whatsapp','2020-01-01T00:00:00Z')`);
    db.exec(`INSERT INTO "Product" VALUES ('p','store-a',2,NULL)`);
    db.exec(`INSERT INTO "OrderItem" VALUES ('o','p','store-a',1)`);

    const results = await Promise.all([
      runInWorker(path, acceptSql, ["o", "sent_to_whatsapp"]),
      runInWorker(path, acceptSql, ["o", "sent_to_whatsapp"]),
    ]);
    assert.deepEqual(results.map((result) => result.changes).sort(), [0, 1]);
    assert.equal(db.prepare(`SELECT "status" FROM "Order" WHERE "id"='o'`).get().status, "confirmed");
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id"='p'`).get().stock, 1, "accept does not change stock");
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
