// Query-plan evidence for the reservation-expiry queries on a populated isolated
// SQLite fixture. Mirrors the real Order/OrderItem tables plus migrations
// 0012/0019/0020. Engine-level only (excludes D1 network/Prisma).
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE "Order" (
    "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "status" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL, "updatedAt" TEXT, "userId" TEXT, "paymentStatus" TEXT DEFAULT 'pending'
  );
  CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "stock" INTEGER NOT NULL, "updatedAt" TEXT);
  CREATE TABLE "OrderItem" ("orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "storeId" TEXT NOT NULL, "quantity" INTEGER NOT NULL);
`);
db.exec(readFileSync("prisma/migrations/0012_order_cancel_inventory_guard.sql", "utf8"));
db.exec(readFileSync("prisma/migrations/0019_order_expiry_lifecycle.sql", "utf8"));
db.exec(readFileSync("prisma/migrations/0020_order_reservation_deadline.sql", "utf8"));

const PRODUCTS = 20_000;
const ORDERS = 20_000;
const ITEMS_PER_ORDER = 2;
const insertProduct = db.prepare('INSERT INTO "Product" ("id","storeId","stock","updatedAt") VALUES (?,?,?,NULL)');
const insertOrder = db.prepare('INSERT INTO "Order" ("id","storeId","status","createdAt","updatedAt","reservationExpiresAt") VALUES (?,?,?,?,?,?)');
const insertItem = db.prepare('INSERT INTO "OrderItem" ("orderId","productId","storeId","quantity") VALUES (?,?,?,?)');
const statuses = ["sent_to_whatsapp", "pending", "confirmed", "shipped", "delivered", "cancelled", "expired"];
db.exec("BEGIN");
for (let i = 0; i < PRODUCTS; i++) insertProduct.run(`p${i}`, `s${i % 5}`, 10);
for (let o = 0; o < ORDERS; o++) {
  const status = statuses[o % statuses.length];
  const created = new Date(Date.UTC(2026, 0, 1, 0, 0, o % 720)).toISOString();
  const expires = status === "sent_to_whatsapp" || status === "pending"
    ? new Date(Date.parse(created) - (o % 3) * 3_600_000).toISOString() // mostly stale
    : null;
  insertOrder.run(`o${o}`, `s${o % 5}`, status, created, created, expires);
  for (let k = 0; k < ITEMS_PER_ORDER; k++) {
    const p = (o * ITEMS_PER_ORDER + k) % PRODUCTS;
    insertItem.run(`o${o}`, `p${p}`, `s${o % 5}`, 1);
  }
}
db.exec("COMMIT");

const SWEEP = `SELECT "id" FROM "Order" WHERE "status" IN ('sent_to_whatsapp','pending') AND "reservationExpiresAt" IS NOT NULL AND "reservationExpiresAt" <= ? ORDER BY "reservationExpiresAt" ASC LIMIT ?`;
const TARGETED = `SELECT DISTINCT o."id" AS id FROM "OrderItem" i JOIN "Order" o ON o."id"=i."orderId" WHERE i."productId" IN (?) AND o."status" IN ('sent_to_whatsapp','pending') AND o."reservationExpiresAt" IS NOT NULL AND o."reservationExpiresAt" <= ? LIMIT ?`;

function plan(sql, params) {
  const rows = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);
  return rows.map((r) => r.detail).join(" | ");
}
function time(sql, params, runs = 200) {
  const stmt = db.prepare(sql);
  for (let i = 0; i < 20; i++) stmt.all(...params);
  const samples = [];
  for (let i = 0; i < runs; i++) { const t = performance.now(); stmt.all(...params); samples.push(performance.now() - t); }
  samples.sort((a, b) => a - b);
  return Number(samples[Math.floor(runs / 2)].toFixed(3));
}
const cut = "2026-01-01T00:00:00.000Z";
const sweepParams = [cut, 25];
const candidate = db.prepare(`SELECT i."productId" AS p FROM "OrderItem" i JOIN "Order" o ON o."id"=i."orderId" WHERE o."status" IN ('sent_to_whatsapp','pending') AND o."reservationExpiresAt" IS NOT NULL AND o."reservationExpiresAt" <= ? LIMIT 1`).get(cut);
const targetParams = [candidate?.p ?? "p0", cut, 50];

console.log(JSON.stringify({
  rows: { products: PRODUCTS, orders: ORDERS, items: ORDERS * ITEMS_PER_ORDER },
  sweep: { plan: plan(SWEEP, sweepParams), p50ms: time(SWEEP, sweepParams), returned: db.prepare(SWEEP).all(...sweepParams).length },
  targeted: { plan: plan(TARGETED, targetParams), p50ms: time(TARGETED, targetParams), returned: db.prepare(TARGETED).all(...targetParams).length },
  indexes: db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'Order%' OR name LIKE 'OrderItem%'").all().map((r) => r.name).sort(),
}, null, 1));
