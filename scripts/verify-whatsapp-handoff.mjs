// Local end-to-end verification of the WhatsApp order-routing handoff.
// Creates a real two-vendor checkout through the API, then reads the guest
// confirmation page and asserts each vendor's WhatsApp link contains only that
// vendor's order. Restores store contact numbers, stock and fixture rows.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const base = process.env.LARKVINE_TEST_BASE_URL ?? "http://127.0.0.1:3000";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error("Local server URL required");
const localFetch = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });

const stateDir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const dbName = readdirSync(stateDir).find((name) => name.startsWith("db") && name.endsWith(".sqlite"));
if (!dbName) throw new Error("Local D1 fixture database is missing");
const db = new DatabaseSync(join(stateDir, dbName));

const storeA = db.prepare('SELECT id, whatsapp, phone FROM "Store" WHERE id = ?').get("local-isolation-a");
const storeB = db.prepare('SELECT id, whatsapp, phone FROM "Store" WHERE id = ?').get("local-isolation-b");
const productA = db.prepare('SELECT id, name, stock FROM "Product" WHERE id = ?').get("local-isolation-product-a");
const productB = db.prepare('SELECT id, name, stock FROM "Product" WHERE id = ?').get("local-isolation-product-b");
assert.ok(storeA && storeB && productA && productB, "Two-vendor fixtures required");

const numberA = "08031112222";
const numberB = "08033334444";
const cleanup = [];
function restore() {
  db.prepare('UPDATE "Store" SET whatsapp = ?, phone = ? WHERE id = ?').run(storeA.whatsapp, storeA.phone, storeA.id);
  db.prepare('UPDATE "Store" SET whatsapp = ?, phone = ? WHERE id = ?').run(storeB.whatsapp, storeB.phone, storeB.id);
  for (const id of cleanup) {
    const items = db.prepare('SELECT id, productId, quantity FROM "OrderItem" WHERE orderId = ?').all(id);
    for (const item of items) db.prepare('UPDATE "Product" SET stock = stock + ? WHERE id = ?').run(item.quantity, item.productId);
    db.prepare('DELETE FROM "OrderItem" WHERE orderId = ?').run(id);
    db.prepare('DELETE FROM "Order" WHERE id = ?').run(id);
  }
  for (const checkoutId of cleanupCheckouts) db.prepare('DELETE FROM "Checkout" WHERE id = ?').run(checkoutId);
  db.close();
}
const cleanupCheckouts = [];
process.once("SIGINT", () => { restore(); process.exit(130); });
process.once("SIGTERM", () => { restore(); process.exit(143); });

try {
  db.prepare('UPDATE "Store" SET whatsapp = ?, phone = NULL WHERE id = ?').run(numberA, storeA.id);
  db.prepare('UPDATE "Store" SET whatsapp = ?, phone = NULL WHERE id = ?').run(numberB, storeB.id);

  const token = randomUUID();
  const response = await localFetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      checkoutToken: token,
      items: [
        { productId: productA.id, quantity: 1, size: "L", color: "As shown" },
        { productId: productB.id, quantity: 1, size: "One Size", color: "As shown" },
      ],
      customer: { name: "Route Test", email: "route-test@example.invalid", phone: "08000000000", whatsapp: "08000000000", address: "1 Test Road", city: "Lagos", state: "Lagos", size: "L" },
    }),
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.ok(data.checkoutId);
  cleanupCheckouts.push(data.checkoutId);
  for (const order of db.prepare('SELECT id FROM "Order" WHERE checkoutId = ?').all(data.checkoutId)) cleanup.push(order.id);

  const page = await localFetch(`${base}/order-confirmation/${data.checkoutId}?token=${token}`);
  const html = await page.text();
  assert.equal(page.status, 200);

  const anchors = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map((match) => match[1]);
  assert.equal(anchors.length, 2, `expected two vendor WhatsApp links, got ${anchors.length}`);

  const decoded = anchors.map((href) => decodeURIComponent(href.split("?text=")[1] ?? ""));
  const decodedA = decoded.find((text) => text.includes("Isolation A")) ?? "";
  const decodedB = decoded.find((text) => text.includes("Isolation B")) ?? "";
  assert.ok(decodedA && decodedB, "each store must have its own message");

  assert.ok(anchors.some((href) => href.startsWith(`https://wa.me/2348031112222?text=`)), "store A number must be normalized to 234 form");
  assert.ok(anchors.some((href) => href.startsWith(`https://wa.me/2348033334444?text=`)), "store B number must be normalized to 234 form");

  assert.ok(decodedA.includes(productA.name) && !decodedA.includes(productB.name), "store A message must not contain store B product");
  assert.ok(decodedB.includes(productB.name) && !decodedB.includes(productA.name), "store B message must not contain store A product");
  for (const text of decoded) {
    assert.ok(!/checkoutToken|tokenHash|requestHash|userId|storeId|productId/i.test(text), "message must not leak internal identifiers");
    assert.ok(text.includes("Payment and delivery are arranged directly with you"));
  }

  // Clicking a handoff link only navigates to wa.me; it must not create another order.
  const ordersBefore = db.prepare('SELECT COUNT(*) AS n FROM "Order"').get().n;
  await localFetch(anchors[0], { redirect: "manual" }).catch(() => {});
  const ordersAfter = db.prepare('SELECT COUNT(*) AS n FROM "Order"').get().n;
  assert.equal(ordersAfter, ordersBefore, "opening WhatsApp must not create an order");

  // Mobile confirmation UX: no overflow and one tappable WhatsApp CTA per seller.
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const confirmation = [];
  try {
    for (const width of [390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.goto(`${base}/order-confirmation/${data.checkoutId}?token=${token}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      const measure = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        whatsappCtas: document.querySelectorAll('a[href^="https://wa.me/"]').length,
      }));
      confirmation.push({ width, ...measure, overflow: measure.documentWidth > width + 1 });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  assert.ok(confirmation.every((entry) => !entry.overflow), "confirmation page must not overflow on mobile");
  assert.ok(confirmation.every((entry) => entry.whatsappCtas === 2), "one WhatsApp CTA per seller on mobile");

  console.log(JSON.stringify({ checkoutId: data.checkoutId, vendorLinks: anchors.length, normalized: true, crossVendorLeakage: false, internalIdsLeaked: false, whatsappClickCreatesOrder: false, mobileConfirmation: confirmation }));
} finally {
  restore();
}
