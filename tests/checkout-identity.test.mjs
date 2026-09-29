import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const migration = readFileSync(new URL("../prisma/migrations/0013_checkout_identity.sql", import.meta.url), "utf8");

test("one checkout token groups vendor orders and cannot be reused", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL);
    `);
    db.exec(migration);
    db.prepare('INSERT INTO "Checkout" ("id","tokenHash","requestHash","email") VALUES (?,?,?,?)')
      .run("checkout-a", "token-hash-a", "request-hash-a", "customer@example.invalid");
    db.prepare('INSERT INTO "Order" ("id","storeId","checkoutId") VALUES (?,?,?)').run("order-a", "store-a", "checkout-a");
    db.prepare('INSERT INTO "Order" ("id","storeId","checkoutId") VALUES (?,?,?)').run("order-b", "store-b", "checkout-a");

    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM "Order" WHERE "checkoutId" = ?').get("checkout-a").count, 2);
    assert.throws(() => db.prepare('INSERT INTO "Checkout" ("id","tokenHash","requestHash","email") VALUES (?,?,?,?)')
      .run("checkout-b", "token-hash-a", "different-request", "other@example.invalid"), /UNIQUE constraint failed/);
    assert.throws(() => db.prepare('DELETE FROM "Checkout" WHERE "id" = ?').run("checkout-a"), /FOREIGN KEY constraint failed/);
  } finally {
    db.close();
  }
});
