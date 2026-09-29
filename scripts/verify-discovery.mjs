// Deterministic local HTTP/catalog integration check; never connects remotely.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const base = process.env.LARKVINE_TEST_BASE_URL ?? "http://127.0.0.1:3000";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error("Local server URL required");
const stateDir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const databaseName = readdirSync(stateDir).find((name) => name.startsWith("db") && name.endsWith(".sqlite"));
if (!databaseName) throw new Error("Local D1 fixture database is missing");
const db = new DatabaseSync(join(stateDir, databaseName));
const prefix = "discovery-fixture-";
const categoryId = `${prefix}category`;
const productId = (index) => `${prefix}${String(index).padStart(2, "0")}`;

async function page(path) {
  const response = await fetch(`${base}${path}`);
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert.ok(!html.includes("NEXT_HTTP_ERROR_FALLBACK"), `${path} rendered an error boundary`);
  return html;
}

try {
  db.prepare('INSERT INTO "Category" (id,storeId,name,slug) VALUES (?,?,?,?)').run(categoryId, "local-isolation-a", "Discovery Test", "discovery-test");
  const insert = db.prepare('INSERT INTO "Product" (id,storeId,name,slug,description,price,stock,published,categoryId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  for (let i = 1; i <= 30; i++) insert.run(productId(i), "local-isolation-a", `Catalog Fixture ${String(i).padStart(2, "0")}`, productId(i), "Synthetic discovery fixture", 100 + i, 1, 1, categoryId, "2030-01-01 00:00:00", "2030-01-01 00:00:00");
  insert.run(`${prefix}draft`, "local-isolation-a", "Hidden Draft Fixture", `${prefix}draft`, "Synthetic discovery fixture", 100, 1, 0, categoryId, "2030-01-01 00:00:00", "2030-01-01 00:00:00");
  insert.run(`${prefix}soldout`, "local-isolation-a", "Hidden Soldout Fixture", `${prefix}soldout`, "Synthetic discovery fixture", 100, 0, 1, categoryId, "2030-01-01 00:00:00", "2030-01-01 00:00:00");

  const first = await page("/shop");
  const second = await page("/shop?page=2");
  const names = (html) => new Set([...html.matchAll(/Catalog Fixture \d{2}/g)].map((match) => match[0]));
  const firstNames = names(first);
  const secondNames = names(second);
  assert.equal(firstNames.size, 24);
  assert.equal(secondNames.size, 6);
  assert.equal([...firstNames].filter((name) => secondNames.has(name)).length, 0);
  assert.ok(first.includes("isolation-a"));
  assert.ok(!first.includes("Hidden Draft Fixture") && !first.includes("Hidden Soldout Fixture"));
  const category = await page(`/shop?category=${categoryId}`);
  assert.equal(names(category).size, 24);
  const vendor = await page("/shop?store=isolation-b");
  assert.ok(vendor.includes("Isolation Product B") && !vendor.includes("Isolation Product A"));
  const price = await page("/shop?minPrice=129&maxPrice=130&sort=price-desc");
  assert.ok(price.includes("Catalog Fixture 29") && price.includes("Catalog Fixture 30"));
  assert.ok(!price.includes("Catalog Fixture 28"));
  const searchFirst = await page("/search?q=Catalog%20Fixture");
  const searchSecond = await page("/search?q=Catalog%20Fixture&page=2");
  assert.equal(names(searchFirst).size, 24);
  assert.equal(names(searchSecond).size, 6);
  const hiddenSearch = await page("/search?q=Hidden%20Draft%20Fixture");
  assert.ok(!hiddenSearch.includes("Hidden Draft Fixture</h3>"));
  const directory = await page("/stores");
  assert.ok(directory.includes("Isolation A") && directory.includes("Isolation B"));
  assert.ok(!directory.includes("pending-fixture"));
  const autocomplete = await fetch(`${base}/api/search?q=Hidden%20Draft%20Fixture`).then((response) => response.json());
  assert.equal(autocomplete.products.length, 0);
  const storePage = await page("/isolation-a");
  assert.ok(!storePage.includes("Isolation Product B"));
  console.log(JSON.stringify({ firstPage: firstNames.size, secondPage: secondNames.size, duplicateProducts: 0, category: "pass", vendor: "pass", price: "pass", search: "pass", hidden: "pass", directory: "pass", autocomplete: "pass", storeIsolation: "pass" }));
} finally {
  db.prepare('DELETE FROM "Product" WHERE id LIKE ?').run(`${prefix}%`);
  db.prepare('DELETE FROM "Category" WHERE id = ?').run(categoryId);
  db.close();
}
