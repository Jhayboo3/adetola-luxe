// Isolated Wrangler D1 migration and backup/restore rehearsal. Never uses --remote.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = mkdtempSync(join(tmpdir(), "larkvine-foundation-"));
const live = join(root, "d1-live");
const backup = join(root, "d1-backup");
const restored = join(root, "d1-restored");
const database = "adetola-luxe-db";
const migrations = readdirSync("prisma/migrations").filter((name) => /^\d{4}.*\.sql$/.test(name)).sort();
const before = migrations.filter((name) => Number(name.slice(0, 4)) <= 11);
const foundation = migrations.filter((name) => Number(name.slice(0, 4)) >= 12 && Number(name.slice(0, 4)) <= 17);
assert.deepEqual(foundation.map((name) => name.slice(0, 4)), ["0012", "0013", "0014", "0015", "0016", "0017"]);

function wrangler(persist, option, value) {
  const args = ["wrangler", "d1", "execute", database, "--local", "--persist-to", persist, "--json", option, value];
  const started = performance.now();
  const result = spawnSync("npx", args, { encoding: "utf8", timeout: 60_000, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  if (result.status !== 0) throw new Error(`Local D1 command failed: ${option} ${value}\n${result.stderr.slice(-1000)}\n${result.stdout.slice(-1000)}`);
  return { elapsedMs: Math.round(performance.now() - started), data: JSON.parse(result.stdout.slice(result.stdout.indexOf("["))) };
}

function query(persist, sql) {
  return wrangler(persist, "--command", sql).data[0].results;
}

function snapshot(persist) {
  const counts = Object.fromEntries(["User", "Store", "Category", "Product", "Order", "OrderItem"].map((table) => [table, query(persist, `SELECT COUNT(*) AS n FROM "${table}"`)[0].n]));
  const inventory = query(persist, 'SELECT id, stock FROM "Product" ORDER BY id');
  const orders = query(persist, 'SELECT id, status, total FROM "Order" ORDER BY id');
  const itemCount = counts.OrderItem;
  const cancelled = orders.filter((order) => order.status === "cancelled").length;
  const totalLegacy = orders.reduce((sum, order) => sum + Number(order.total), 0);
  return { counts, inventory, orderIds: orders.map(({ id, status }) => ({ id, status })), itemCount, cancelled, totalLegacy };
}

function databaseFile(persist) {
  const directory = join(persist, "v3/d1/miniflare-D1DatabaseObject");
  const name = readdirSync(directory).find((entry) => /^db.*\.sqlite$/.test(entry));
  assert.ok(name);
  return join(directory, name);
}

for (const name of before) {
  wrangler(live, "--file", `prisma/migrations/${name}`);
  if (name.startsWith("0004")) {
    query(live, `INSERT INTO "User" (id,email,name,password,role) VALUES ('rehearsal-admin','rehearsal@example.invalid','Rehearsal Admin','fixture-only','admin')`);
  }
}

// Representative pre-0012 history: one ordinary order, one already-cancelled
// order, and a product price requiring explicit monetary review.
query(live, `INSERT INTO "Product" (id,name,slug,description,price,stock,updatedAt,storeId,published) VALUES
  ('rehearsal-product','Rehearsal Product','rehearsal-product','Synthetic fixture',12.34,5,CURRENT_TIMESTAMP,'store_tnc_collections',1),
  ('ambiguous-price','Ambiguous Price','ambiguous-price','Synthetic fixture',10.005,4,CURRENT_TIMESTAMP,'store_tnc_collections',0)`);
query(live, `INSERT INTO "Order" (id,email,name,address,city,state,zip,subtotal,total,status,updatedAt,storeId,checkoutToken) VALUES
  ('history-order','history@example.invalid','History Customer','Fixture Address','Lagos','Lagos','',12.34,12.34,'pending',CURRENT_TIMESTAMP,'store_tnc_collections','legacy-token'),
  ('cancelled-order','cancelled@example.invalid','Cancelled Customer','Fixture Address','Lagos','Lagos','',12.34,12.34,'cancelled',CURRENT_TIMESTAMP,'store_tnc_collections',NULL)`);
query(live, `INSERT INTO "OrderItem" (id,orderId,productId,quantity,size,color,price,storeId) VALUES
  ('history-item','history-order','rehearsal-product',1,'L','As shown',12.34,'store_tnc_collections'),
  ('cancelled-item','cancelled-order','rehearsal-product',1,'L','As shown',12.34,'store_tnc_collections')`);

const initial = snapshot(live);
const compatibility = {
  historicalOrdersWithoutCheckout: initial.counts.Order,
  historicalCancelledOrdersRequiringInventoryReview: initial.cancelled,
  productsWithMoreThanTwoDecimals: query(live, 'SELECT COUNT(*) AS n FROM "Product" WHERE ABS(price * 100 - ROUND(price * 100)) > 0.000001')[0].n,
  crossStoreItems: query(live, 'SELECT COUNT(*) AS n FROM "OrderItem" i JOIN "Order" o ON o.id=i.orderId JOIN "Product" p ON p.id=i.productId WHERE i.storeId<>o.storeId OR i.storeId<>p.storeId')[0].n,
  orphanItems: query(live, 'SELECT COUNT(*) AS n FROM "OrderItem" i LEFT JOIN "Order" o ON o.id=i.orderId LEFT JOIN "Product" p ON p.id=i.productId WHERE o.id IS NULL OR p.id IS NULL')[0].n,
};
cpSync(live, backup, { recursive: true });
const backupHash = createHash("sha256").update(readFileSync(databaseFile(backup))).digest("hex");
const times = [];
for (const name of foundation) times.push({ migration: name, elapsedMs: wrangler(live, "--file", `prisma/migrations/${name}`).elapsedMs });
const after = snapshot(live);
assert.deepEqual(after, initial, "Foundation migrations changed historical rows or inventory");
assert.equal(query(live, 'SELECT COUNT(*) AS n FROM "Checkout"')[0].n, 0);
assert.equal(query(live, 'SELECT COUNT(*) AS n FROM "Order" WHERE checkoutId IS NULL AND totalMinor IS NULL')[0].n, initial.counts.Order);

// Rehearse failed smoke test recovery before accepting new writes: restore the
// untouched backup as a new isolated D1 state and compare content/schema.
cpSync(backup, restored, { recursive: true });
const restoredSnapshot = snapshot(restored);
assert.deepEqual(restoredSnapshot, initial);
assert.equal(createHash("sha256").update(readFileSync(databaseFile(restored))).digest("hex"), backupHash);
assert.equal(query(restored, "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='Checkout'")[0].n, 0);
const partial = query(live, "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='Checkout'")[0].n;
assert.equal(partial, 1);
console.log(JSON.stringify({ initial, compatibility, times, unchangedAfterMigration: true, backupRestored: true, partialSchemaDetected: true, rehearsalDirectory: root }, null, 2));
