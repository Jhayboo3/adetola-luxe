// Query-plan comparison on an isolated, migrated SQLite copy of local D1.
import { DatabaseSync } from "node:sqlite";
import { readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sourceDir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const name = readdirSync(sourceDir).find((entry) => entry.startsWith("db") && entry.endsWith(".sqlite"));
if (!name) throw new Error("Migrated local D1 fixture missing");
const source = new DatabaseSync(join(sourceDir, name), { readOnly: true });
const destination = join(mkdtempSync(join(tmpdir(), "larkvine-query-")), "catalog.sqlite");
source.prepare("VACUUM INTO ?").run(destination);
source.close();
const db = new DatabaseSync(destination);
const insert = db.prepare('INSERT INTO "Product" (id,storeId,name,slug,description,price,stock,published,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)');
db.exec("BEGIN");
for (let i = 0; i < 5000; i++) {
  const id = `query-fixture-${String(i).padStart(5, "0")}`;
  insert.run(id, i % 2 ? "local-isolation-a" : "local-isolation-b", `Fixture Product ${i}`, id, "Synthetic catalog sample", (i % 900) + 1, i % 11 ? 4 : 0, i % 13 ? 1 : 0, `2026-09-${String((i % 28) + 1).padStart(2, "0")} 00:00:00`, "2026-09-29 00:00:00");
}
db.exec("COMMIT");

const queries = {
  newest: `SELECT p.id FROM "Product" p JOIN "Store" s ON s.id=p.storeId WHERE p.published=1 AND p.stock>0 AND s.status='approved' ORDER BY p.createdAt DESC,p.id DESC LIMIT 25`,
  price: `SELECT p.id FROM "Product" p JOIN "Store" s ON s.id=p.storeId WHERE p.published=1 AND p.stock>0 AND s.status='approved' ORDER BY p.price ASC,p.id DESC LIMIT 25`,
  priceDesc: `SELECT p.id FROM "Product" p JOIN "Store" s ON s.id=p.storeId WHERE p.published=1 AND p.stock>0 AND s.status='approved' ORDER BY p.price DESC,p.id DESC LIMIT 25`,
  search: `SELECT p.id FROM "Product" p JOIN "Store" s ON s.id=p.storeId WHERE p.published=1 AND p.stock>0 AND s.status='approved' AND (p.name LIKE '%Product 42%' OR p.description LIKE '%Product 42%') ORDER BY p.createdAt DESC,p.id DESC LIMIT 25`,
  vendor: `SELECT p.id FROM "Product" p JOIN "Store" s ON s.id=p.storeId WHERE p.published=1 AND p.stock>0 AND s.status='approved' AND p.storeId='local-isolation-a' ORDER BY p.createdAt DESC,p.id DESC LIMIT 25`,
};

function measure(sql) {
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((row) => row.detail);
  const statement = db.prepare(sql);
  for (let i = 0; i < 10; i++) statement.all();
  const samples = [];
  for (let i = 0; i < 100; i++) { const start = performance.now(); statement.all(); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  return { rows: statement.all().length, p50Ms: Number(samples[50].toFixed(3)), p95Ms: Number(samples[95].toFixed(3)), plan };
}

const before = Object.fromEntries(Object.entries(queries).map(([name, sql]) => [name, measure(sql)]));
db.exec('CREATE INDEX "Product_catalog_newest_candidate" ON "Product"("published", "createdAt" DESC, "id" DESC)');
db.exec('CREATE INDEX "Product_catalog_price_candidate" ON "Product"("published", "price" ASC, "id" DESC)');
const after = Object.fromEntries(Object.entries(queries).map(([name, sql]) => [name, measure(sql)]));
console.log(JSON.stringify({ fixtureProducts: db.prepare('SELECT COUNT(*) AS n FROM "Product"').get().n, before, after, database: destination }, null, 2));
db.close();
