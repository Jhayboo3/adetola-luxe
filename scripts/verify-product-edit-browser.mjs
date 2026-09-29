// Local-only browser/server-action authorization check using synthetic D1 users.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { chromium } from "playwright-core";

const base = "http://localhost:3000";
const stateDir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const dbName = readdirSync(stateDir).find((name) => name.startsWith("db") && name.endsWith(".sqlite"));
if (!dbName) throw new Error("Migrated local D1 fixture required");
const db = new DatabaseSync(join(stateDir, dbName));
const emails = ["vendor-a@example.invalid", "vendor-b@example.invalid"];
const users = db.prepare('SELECT id,email,password FROM "User" WHERE email IN (?,?)').all(...emails);
assert.equal(users.length, 2, "Synthetic vendor accounts required");
const original = users.map((user) => ({ ...user }));
const storeA = db.prepare('SELECT id,status FROM "Store" WHERE ownerId=?').get(users.find((user) => user.email === emails[0]).id);
const ownId = "local-isolation-product-a";
const otherId = "local-isolation-product-b";
const snapshot = (id) => db.prepare('SELECT name,price,priceMinor,stock,published FROM "Product" WHERE id=?').get(id);
const ownBefore = snapshot(ownId);
const otherBefore = snapshot(otherId);
assert.ok(ownBefore && otherBefore);
const password = randomUUID();
const hash = bcrypt.hashSync(password, 8);
for (const user of users) db.prepare('UPDATE "User" SET password=? WHERE id=?').run(hash, user.id);
let browser;

async function login(context, email) {
  const csrf = await context.request.get(`${base}/api/auth/csrf`);
  const { csrfToken } = await csrf.json();
  await context.request.post(`${base}/api/auth/callback/credentials`, {
    form: { csrfToken, email, password, callbackUrl: `${base}/admin/products`, json: "true" },
    maxRedirects: 0,
  });
  const session = await context.request.get(`${base}/api/auth/session`).then((response) => response.json());
  assert.equal(session.user?.email, email, `Sign-in failed for ${email}`);
  const page = await context.newPage();
  await page.goto(`${base}/admin/products`);
  await page.getByRole("heading", { name: /Products|Clothing/i }).first().waitFor({ timeout: 15000 });
  return page;
}

try {
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  const a = await login(aContext, emails[0]);
  const b = await login(bContext, emails[1]);
  // Legitimate bound action, with values restored afterward to avoid altering fixtures.
  await a.goto(`${base}/admin/products/${ownId}`);
  await a.getByLabel("Price (₦)").fill(String(ownBefore.price + 1));
  await a.getByLabel("Stock Quantity").fill(String(ownBefore.stock + 1));
  await a.getByRole("button", { name: "Save Changes" }).click();
  try { await a.waitForURL((url) => url.pathname === "/admin/products", { timeout: 8000 }); }
  catch {
    console.log("legitimate edit diagnostics", { url: a.url(), error: await a.locator("form p").allTextContents(), after: snapshot(ownId), validation: await a.locator("form").last().evaluate((form) => form.checkValidity()) });
    throw new Error("Legitimate product edit did not complete");
  }
  assert.equal(snapshot(ownId).price, ownBefore.price + 1);
  assert.equal(snapshot(ownId).stock, ownBefore.stock + 1);
  db.prepare('UPDATE "Product" SET price=?,priceMinor=?,stock=? WHERE id=?').run(ownBefore.price, ownBefore.priceMinor, ownBefore.stock, ownId);

  await b.goto(`${base}/admin/products/${otherId}`);
  // Capture the real client form's bound action POST before it reaches the
  // server. Replaying it under Vendor A's cookie tests the action boundary.
  async function captureEdit(page, id, price, stock, published) {
    await page.goto(`${base}/admin/products/${id}`);
    await page.getByLabel("Price (₦)").fill(String(price));
    await page.getByLabel("Stock Quantity").fill(String(stock));
    const checkbox = page.getByLabel("Visible in shop");
    if (published) await checkbox.check(); else await checkbox.uncheck();
    let resolveRequest;
    const captured = new Promise((resolve) => { resolveRequest = resolve; });
    const handler = async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || !request.url().includes(`/admin/products/${id}`)) return route.continue();
      resolveRequest({ body: request.postDataBuffer(), headers: request.headers(), id });
      await route.abort();
    };
    await page.route("**/admin/products/**", handler);
    await page.getByRole("button", { name: "Save Changes" }).click();
    const request = await Promise.race([captured, new Promise((_, reject) => setTimeout(() => reject(new Error("Bound action POST was not sent")), 10000))]);
    await page.unroute("**/admin/products/**", handler);
    return request;
  }

  async function replay(request) {
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([key]) => ["content-type", "next-action", "next-router-state-tree", "accept", "rsc"].includes(key)));
    return a.evaluate(async ({ id, headers, bytes }) => {
      const response = await fetch(`/admin/products/${id}`, { method: "POST", headers, body: new Uint8Array(bytes), credentials: "same-origin" });
      return { status: response.status, body: await response.text() };
    }, { id: request.id, headers, bytes: [...request.body] });
  }

  const attempts = [
    { label: "price", fields: { price: String(otherBefore.price + 7), stock: String(otherBefore.stock), published: "on" } },
    { label: "stock", fields: { price: String(otherBefore.price), stock: String(otherBefore.stock + 3), published: "on" } },
    { label: "unpublish", fields: { price: String(otherBefore.price), stock: String(otherBefore.stock) } },
  ];
  for (const attempt of attempts) {
    const request = await captureEdit(b, otherId, attempt.fields.price, attempt.fields.stock, attempt.fields.published === "on");
    const response = await replay(request);
    assert.deepEqual(snapshot(otherId), otherBefore, `Vendor A changed B ${attempt.label}`);
    console.log(JSON.stringify({ attempt: attempt.label, status: response.status, unchanged: true }));
  }

  await a.goto(`${base}/admin/products/${otherId}`);
  assert.ok((await a.content()).includes("NEXT_HTTP_ERROR_FALLBACK"), "Vendor A should not render B edit form");

  db.prepare('UPDATE "Store" SET status=? WHERE id=?').run("suspended", storeA.id);
  try {
    db.prepare('UPDATE "Store" SET status=? WHERE id=?').run(storeA.status, storeA.id);
    const request = await captureEdit(a, ownId, ownBefore.price + 9, ownBefore.stock, true);
    db.prepare('UPDATE "Store" SET status=? WHERE id=?').run("suspended", storeA.id);
    const response = await replay(request);
    assert.deepEqual(snapshot(ownId), ownBefore);
    console.log(JSON.stringify({ attempt: "suspended vendor", status: response.status, unchanged: true }));
  } finally {
    db.prepare('UPDATE "Store" SET status=? WHERE id=?').run(storeA.status, storeA.id);
  }
  console.log(JSON.stringify({ legitimateEdit: "pass", crossVendorBoundAction: "no mutation" }));
} finally {
  if (browser) await browser.close();
  db.prepare('UPDATE "Product" SET price=?,priceMinor=?,stock=? WHERE id=?').run(ownBefore.price, ownBefore.priceMinor, ownBefore.stock, ownId);
  for (const user of original) db.prepare('UPDATE "User" SET password=? WHERE id=?').run(user.password, user.id);
  db.prepare('UPDATE "Store" SET status=? WHERE id=?').run(storeA.status, storeA.id);
  db.close();
}
