// Prepare a migrated LOCAL D1 so the worker-runtime gate and other local-only
// verification scripts can render pages that read the database. Idempotent:
// if the `User` table already exists it does nothing. Never touches remote D1.
//
// Optional WRANGLER_PERSIST_TO=<dir> to target an isolated local state (used to
// test the fresh path without disturbing the default .wrangler state).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const DB = "adetola-luxe-db";
const persistTo = process.env.WRANGLER_PERSIST_TO;

function d1(sql, { file = false } = {}) {
  const args = ["wrangler", "d1", "execute", DB, "--local", "--json"];
  if (persistTo) args.push("--persist-to", persistTo);
  args.push(file ? "--file" : "--command", sql);
  return spawnSync("npx", args, { encoding: "utf8", timeout: 120_000 });
}
function query(sql) {
  const result = d1(sql);
  const text = result.stdout || "";
  const start = text.indexOf("[");
  if (start === -1) throw new Error(`local d1 query failed: ${(result.stderr || text).slice(-400)}`);
  return JSON.parse(text.slice(start))[0].results;
}

const tables = query("SELECT name FROM sqlite_master WHERE type='table'");
if (tables.some((row) => row.name === "User")) {
  console.log("local D1 already migrated; skipping");
  process.exit(0);
}

const migrations = readdirSync("prisma/migrations").filter((name) => /^\d{4}.*\.sql$/.test(name)).sort();
for (const name of migrations) {
  const result = d1(`prisma/migrations/${name}`, { file: true });
  if (result.status !== 0) throw new Error(`migration ${name} failed: ${(result.stderr || result.stdout).slice(-500)}`);
  // 0005 seeds a Store owned by the first admin user; insert a local-only admin.
  if (name.startsWith("0004")) {
    const insert = d1(`INSERT INTO "User" (id,email,name,password,role,createdAt,updatedAt) VALUES ('local-ci-admin','local-ci-admin@example.invalid','Local CI Admin','x','admin',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
    if (insert.status !== 0) throw new Error(`admin seed failed: ${(insert.stderr || insert.stdout).slice(-300)}`);
  }
}

// Deterministic fixtures so the worker-runtime gate can exercise a real product
// page without any production data. Fixed ids make this idempotent.
const seed = d1(`INSERT OR IGNORE INTO "Store" (id,name,slug,ownerId,status,createdAt,updatedAt) VALUES ('runtime-check-store','Runtime Check Store','runtime-check','local-ci-admin','approved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
if (seed.status !== 0) throw new Error(`store seed failed: ${(seed.stderr || seed.stdout).slice(-300)}`);
const product = d1(`INSERT OR IGNORE INTO "Product" (id,storeId,name,slug,description,price,priceMinor,stock,published,images,sizes,colors,colorSelectable,updatedAt,createdAt) VALUES ('runtime-check-product','runtime-check-store','Runtime Check Product','runtime-check-product','Local runtime fixture',100,10000,5,1,'[]','[]','[]',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
if (product.status !== 0) throw new Error(`product seed failed: ${(product.stderr || product.stdout).slice(-300)}`);

console.log(`local D1 migrated (${migrations.length} migrations) + runtime fixtures`);
