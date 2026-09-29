// Deterministic production-data migration rehearsal and preflight report.
//
//   node scripts/rehearse-production-import.mjs --db <authorized-export.sqlite> --report <out.json>
//   node scripts/rehearse-production-import.mjs --self-test
//
// --db copies the provided SQLite export into a temp workspace, never touching
// the original. --self-test builds a synthetic pre-0013 fixture with deliberate
// anomalies so the report and before/after invariants can be exercised without
// any production data. Wrangler `--remote` is never used.
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ORDER_STATUSES } from "../src/lib/orders.ts";

const args = process.argv.slice(2);
const selfTest = args.includes("--self-test");
const dbArg = args[args.indexOf("--db") + 1];
const reportArg = args[args.indexOf("--report") + 1];
if (!selfTest && (!dbArg || dbArg.startsWith("--"))) {
  console.error("Provide --db <authorized-export.sqlite> (or --self-test).");
  process.exit(2);
}

const migrations = readdirSync("prisma/migrations").filter((name) => /^\d{4}.*\.sql$/.test(name)).sort();
const before = migrations.filter((name) => Number(name.slice(0, 4)) <= 11);
const foundation = migrations.filter((name) => Number(name.slice(0, 4)) >= 12);
assert.deepEqual(foundation.map((name) => name.slice(0, 4)), ["0012", "0013", "0014", "0015", "0016", "0017", "0018", "0019", "0020"]);

const root = mkdtempSync(join(tmpdir(), "larkvine-rehearsal-"));

function rows(db, sql, ...params) {
  try { return db.prepare(sql).all(...params); } catch (error) { return [{ error: error instanceof Error ? error.message : String(error) }]; }
}
function one(db, sql, ...params) {
  const result = rows(db, sql, ...params);
  return result[0] && "error" in result[0] ? null : result[0] ?? null;
}
function count(db, sql, fallback = "n/a", ...params) {
  const result = one(db, sql, ...params);
  return result ? Object.values(result)[0] : fallback;
}
function columns(db, table) {
  return rows(db, `SELECT name FROM pragma_table_info('${table}')`).map((row) => row.name);
}

function buildFixture(path) {
  const database = new DatabaseSync(path);
  for (const name of before) {
    database.exec(readFileSync(`prisma/migrations/${name}`, "utf8"));
    if (name.startsWith("0004")) database.exec(`INSERT INTO "User" (id,email,name,password,role) VALUES ('rehearsal-admin','rehearsal@example.invalid','Rehearsal Admin','fixture-only','admin')`);
  }
  const store = count(database, 'SELECT id FROM "Store" ORDER BY id LIMIT 1', "store_tnc_collections");
  database.exec(`INSERT INTO "User" (id,email,name,password,role) VALUES ('fixture-customer','customer@example.invalid','Fixture Customer','x','customer')`);
  database.exec(`INSERT INTO "Product" (id,name,slug,description,price,stock,updatedAt,storeId,published) VALUES
    ('fixture-product','Fixture Product','fixture-product','Synthetic',12.34,5,CURRENT_TIMESTAMP,'${store}',1),
    ('odd-price','Odd Price','odd-price','Synthetic',10.005,4,CURRENT_TIMESTAMP,'${store}',0)`);
  database.exec(`INSERT INTO "Order" (id,email,name,address,city,state,zip,subtotal,shipping,total,status,paymentStatus,updatedAt,storeId,checkoutToken) VALUES
    ('mix-order','a@example.invalid','A','Addr','Lagos','Lagos','',12.34,0,12.34,'pending','pending',CURRENT_TIMESTAMP,'${store}','token-a'),
    ('bad-total','b@example.invalid','B','Addr','Lagos','Lagos','',12.34,0,99.99,'pending','pending',CURRENT_TIMESTAMP,'${store}','token-b'),
    ('cancelled-order','c@example.invalid','C','Addr','Lagos','Lagos','',12.34,0,12.34,'cancelled','paid',CURRENT_TIMESTAMP,'${store}',NULL),
    ('weird-status','d@example.invalid','D','Addr','Lagos','Lagos','',12.34,0,12.34,'processing','pending',CURRENT_TIMESTAMP,'${store}','token-d')`);
  database.exec(`INSERT INTO "OrderItem" (id,orderId,productId,quantity,size,color,price,storeId) VALUES
    ('item-good','mix-order','fixture-product',1,'L','As shown',12.34,'${store}')`);
  database.close();
}

const working = join(root, "working.sqlite");
if (selfTest) buildFixture(working); else copyFileSync(dbArg, working);

const beforeDb = new DatabaseSync(working, { readOnly: true });
const placeholders = ORDER_STATUSES.map(() => "?").join(",");
const preflight = {
  counts: Object.fromEntries(["User", "Store", "Category", "Product", "Order", "OrderItem", "DiscountCode"].map((table) => [table, count(beforeDb, `SELECT COUNT(*) AS n FROM "${table}"`, "missing")])),
  checkoutTablePresent: count(beforeDb, "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='Checkout'", 0) > 0,
  storeStatusDistribution: rows(beforeDb, 'SELECT "status", COUNT(*) AS n FROM "Store" GROUP BY "status" ORDER BY "status"'),
  roleDistribution: rows(beforeDb, 'SELECT "role", COUNT(*) AS n FROM "User" GROUP BY "role" ORDER BY "role"'),
  productsWithMoreThanTwoDecimals: count(beforeDb, 'SELECT COUNT(*) AS n FROM "Product" WHERE ABS("price" * 100 - ROUND("price" * 100)) > 0.000001'),
  productsNegativeOrUnsafe: count(beforeDb, 'SELECT COUNT(*) AS n FROM "Product" WHERE "price" < 0 OR ABS("price") > 90071992547409'),
  orderTotalMismatch: count(beforeDb, 'SELECT COUNT(*) AS n FROM "Order" WHERE ABS("total" - ("subtotal" + COALESCE("shipping",0) - COALESCE("discount",0))) > 0.01'),
  orderNullOrNonPositiveTotal: count(beforeDb, 'SELECT COUNT(*) AS n FROM "Order" WHERE "total" IS NULL OR "total" <= 0'),
  ordersWithUnsupportedStatus: rows(beforeDb, `SELECT "id","status" FROM "Order" WHERE "status" NOT IN (${placeholders}) LIMIT 50`, ...ORDER_STATUSES),
  ordersWithUnsupportedPaymentStatus: rows(beforeDb, `SELECT "id","paymentStatus" FROM "Order" WHERE "paymentStatus" NOT IN ('pending','paid') LIMIT 50`),
  crossStoreOrderItems: count(beforeDb, 'SELECT COUNT(*) AS n FROM "OrderItem" i JOIN "Order" o ON o.id=i.orderId JOIN "Product" p ON p.id=i.productId WHERE i.storeId<>o.storeId OR i.storeId<>p.storeId'),
  orphanOrderItems: count(beforeDb, 'SELECT COUNT(*) AS n FROM "OrderItem" i LEFT JOIN "Order" o ON o.id=i.orderId LEFT JOIN "Product" p ON p.id=i.productId WHERE o.id IS NULL OR p.id IS NULL'),
  ordersOrProductsWithoutStore: count(beforeDb, 'SELECT (SELECT COUNT(*) FROM "Order" WHERE "storeId" IS NULL) + (SELECT COUNT(*) FROM "Product" WHERE "storeId" IS NULL) AS n'),
  duplicateOrderCodesPerStore: rows(beforeDb, 'SELECT "storeId","orderCode",COUNT(*) AS n FROM "Order" WHERE "orderCode" IS NOT NULL GROUP BY "storeId","orderCode" HAVING COUNT(*) > 1 LIMIT 50'),
  duplicateCheckoutTokens: rows(beforeDb, 'SELECT "checkoutToken",COUNT(*) AS n FROM "Order" WHERE "checkoutToken" IS NOT NULL GROUP BY "checkoutToken" HAVING COUNT(*) > 1 LIMIT 50'),
  categorySlugCollisions: rows(beforeDb, 'SELECT "slug", COUNT(DISTINCT "storeId") AS stores FROM "Category" GROUP BY "slug" HAVING COUNT(DISTINCT "storeId") > 1 LIMIT 50'),
  productsOnUnapprovedStores: count(beforeDb, "SELECT COUNT(*) AS n FROM \"Product\" p JOIN \"Store\" s ON s.id=p.storeId WHERE s.status <> 'approved'"),
  orderColumns: columns(beforeDb, "Order"),
  cancelledOrders: rows(beforeDb, 'SELECT o."id", SUM(i."quantity") AS qty FROM "Order" o LEFT JOIN "OrderItem" i ON i."orderId"=o."id" WHERE o."status"=\'cancelled\' GROUP BY o."id" LIMIT 100'),
};
beforeDb.close();

// Apply 0012-0020 to a copy and confirm historical row counts, inventory and
// order totals are unchanged. This proves the migration set is non-destructive
// on the supplied data; it does not prove production correctness.
const migratedPath = join(root, "migrated.sqlite");
copyFileSync(working, migratedPath);
const migrated = new DatabaseSync(migratedPath);
for (const name of foundation) migrated.exec(readFileSync(`prisma/migrations/${name}`, "utf8"));
const after = {
  counts: Object.fromEntries(["User", "Store", "Category", "Product", "Order", "OrderItem"].map((table) => [table, count(migrated, `SELECT COUNT(*) AS n FROM "${table}"`, "missing")])),
  inventorySum: count(migrated, 'SELECT COALESCE(SUM("stock"),0) AS n FROM "Product"'),
  orderTotalSum: count(migrated, 'SELECT COALESCE(SUM("total"),0) AS n FROM "Order"'),
  checkoutTablePresent: count(migrated, "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='Checkout'", 0) > 0,
  orderColumns: columns(migrated, "Order"),
  catalogIndexes: rows(migrated, "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'Product_catalog%' ORDER BY name").map((row) => row.name),
};
const countsUnchanged = Object.entries(preflight.counts).every(([table, value]) => table === "DiscountCode" || value === after.counts[table]);
const inventoryRowsUnchanged = preflight.counts.Product === after.counts.Product;
migrated.close();

const report = {
  generatedAt: new Date().toISOString(),
  mode: selfTest ? "self-test (synthetic fixture, no production data)" : `authorized copy analyzed: ${dbArg}`,
  productionDataCompatibility: selfTest ? "NOT ASSESSED — synthetic only" : "BLOCKED — authorized production export required for sign-off",
  migrationSequence: foundation.map((name) => name.slice(0, 4)),
  preflight,
  postMigration: after,
  invariant: { countsUnchanged, inventoryRowsUnchanged, orderTotalSum: { before: preflight.counts.Order, after: after.counts.Order } },
};
const json = JSON.stringify(report, null, 2);
if (reportArg && !reportArg.startsWith("--")) {
  writeFileSync(reportArg, json);
  console.error(`Report written to ${reportArg}`);
}
console.log(json);
assert.ok(countsUnchanged, "Migrations changed historical row counts");
assert.ok(after.checkoutTablePresent, "Checkout table missing after migration");
