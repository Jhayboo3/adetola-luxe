import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const migration = readFileSync(new URL("../prisma/migrations/0017_checkout_eligibility_guard.sql", import.meta.url), "utf8");

test("store suspension or product unpublish before order commit blocks inventory mutation", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE "Store" ("id" TEXT PRIMARY KEY, "status" TEXT NOT NULL);
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "published" INTEGER NOT NULL, "stock" INTEGER NOT NULL);
      CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY, "productId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
      CREATE TRIGGER stock_decrement BEFORE INSERT ON "OrderItem" BEGIN
        UPDATE "Product" SET "stock" = "stock" - NEW."quantity" WHERE "id" = NEW."productId";
      END;
      INSERT INTO "Store" VALUES ('store-a', 'approved');
      INSERT INTO "Product" VALUES ('product-a', 'store-a', 1, 3);
    `);
    db.exec(migration);
    const insert = db.prepare('INSERT INTO "OrderItem" VALUES (?,?,?)');
    db.exec("UPDATE \"Store\" SET \"status\" = 'suspended' WHERE \"id\" = 'store-a'");
    assert.throws(() => insert.run("item-1", "product-a", 1), /unavailable/);
    db.exec("UPDATE \"Store\" SET \"status\" = 'approved' WHERE \"id\" = 'store-a'");
    db.exec("UPDATE \"Product\" SET \"published\" = 0 WHERE \"id\" = 'product-a'");
    assert.throws(() => insert.run("item-2", "product-a", 1), /unavailable/);
    assert.equal(db.prepare('SELECT "stock" FROM "Product"').get().stock, 3);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM "OrderItem"').get().count, 0);
  } finally {
    db.close();
  }
});
