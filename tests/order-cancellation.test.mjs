import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { Worker } from "node:worker_threads";

const migration = readFileSync(new URL("../prisma/migrations/0012_order_cancel_inventory_guard.sql", import.meta.url), "utf8");

const updateWorker = `
  const { parentPort, workerData } = require('node:worker_threads');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(workerData.path);
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    const result = db.prepare('UPDATE "Order" SET "status" = ? WHERE "id" = ? AND "status" <> ?')
      .run(workerData.status, 'order-a', 'cancelled');
    parentPort.postMessage({ changes: result.changes });
  } catch (error) {
    parentPort.postMessage({ error: String(error) });
  } finally {
    db.close();
  }
`;

function updateFromWorker(path, status) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(updateWorker, { eval: true, workerData: { path, status } });
    worker.once("message", (result) => result.error ? reject(new Error(result.error)) : resolve(result));
    worker.once("error", reject);
    worker.once("exit", (code) => { if (code !== 0) reject(new Error(`Worker exited ${code}`)); });
  });
}

test("cancellation restores stock once and cancelled orders stay closed", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "status" TEXT NOT NULL);
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "stock" INTEGER NOT NULL, "updatedAt" TEXT);
      CREATE TABLE "OrderItem" ("orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
      INSERT INTO "Order" VALUES ('order-a', 'store-a', 'confirmed');
      INSERT INTO "Product" VALUES ('product-a', 'store-a', 2, NULL);
      INSERT INTO "Product" VALUES ('product-b', 'store-b', 9, NULL);
      INSERT INTO "OrderItem" VALUES ('order-a', 'product-a', 1);
      INSERT INTO "OrderItem" VALUES ('order-a', 'product-a', 2);
      INSERT INTO "OrderItem" VALUES ('order-a', 'product-b', 1);
    `);
    db.exec(migration);

    db.exec(`UPDATE "Order" SET "status" = 'cancelled' WHERE "id" = 'order-a'`);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id" = 'product-a'`).get().stock, 5);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id" = 'product-b'`).get().stock, 9);

    db.exec(`UPDATE "Order" SET "status" = 'cancelled' WHERE "id" = 'order-a'`);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id" = 'product-a'`).get().stock, 5);

    assert.throws(() => db.exec(`UPDATE "Order" SET "status" = 'confirmed' WHERE "id" = 'order-a'`), /Cancelled order cannot be reopened/);
    assert.equal(db.prepare(`SELECT "status" FROM "Order" WHERE "id" = 'order-a'`).get().status, "cancelled");
  } finally {
    db.close();
  }
});

test("simultaneous cancellation writes restore inventory once", async () => {
  const directory = mkdtempSync(join(tmpdir(), "larkvine-cancel-test-"));
  const path = join(directory, "orders.sqlite");
  const db = new DatabaseSync(path);
  try {
    db.exec(`
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "status" TEXT NOT NULL);
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "stock" INTEGER NOT NULL, "updatedAt" TEXT);
      CREATE TABLE "OrderItem" ("orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
      INSERT INTO "Order" VALUES ('order-a', 'store-a', 'confirmed');
      INSERT INTO "Product" VALUES ('product-a', 'store-a', 2, NULL);
      INSERT INTO "OrderItem" VALUES ('order-a', 'product-a', 1);
    `);
    db.exec(migration);

    const results = await Promise.all([updateFromWorker(path, "cancelled"), updateFromWorker(path, "cancelled")]);
    assert.deepEqual(results.map((result) => Number(result.changes)).sort(), [0, 1]);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id" = 'product-a'`).get().stock, 3);
    assert.equal(db.prepare(`SELECT "status" FROM "Order" WHERE "id" = 'order-a'`).get().status, "cancelled");

    const retry = await updateFromWorker(path, "cancelled");
    assert.equal(Number(retry.changes), 0);
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id" = 'product-a'`).get().stock, 3);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("cancellation racing another status update never reopens the order", async () => {
  const directory = mkdtempSync(join(tmpdir(), "larkvine-transition-test-"));
  const path = join(directory, "orders.sqlite");
  const db = new DatabaseSync(path);
  try {
    db.exec(`
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "status" TEXT NOT NULL);
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "stock" INTEGER NOT NULL, "updatedAt" TEXT);
      CREATE TABLE "OrderItem" ("orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
      INSERT INTO "Order" VALUES ('order-a', 'store-a', 'confirmed');
      INSERT INTO "Product" VALUES ('product-a', 'store-a', 2, NULL);
      INSERT INTO "OrderItem" VALUES ('order-a', 'product-a', 1);
    `);
    db.exec(migration);

    await Promise.all([updateFromWorker(path, "cancelled"), updateFromWorker(path, "shipped")]);
    assert.equal(db.prepare(`SELECT "status" FROM "Order" WHERE "id" = 'order-a'`).get().status, "cancelled");
    assert.equal(db.prepare(`SELECT "stock" FROM "Product" WHERE "id" = 'product-a'`).get().stock, 3);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
