// Local-only HTTP integration check. Run with the migrated local D1 emulator
// and `npm run dev`; no remote database or production credentials are used.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { checkoutAttemptToken } from "../src/lib/checkout-attempt.ts";

const base = process.env.LARKVINE_TEST_BASE_URL ?? "http://127.0.0.1:3000";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error("Local server URL required");
const localFetch = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
const stateDir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const databaseName = readdirSync(stateDir).find((name) => name.startsWith("db") && name.endsWith(".sqlite"));
if (!databaseName) throw new Error("Local D1 fixture database is missing");
const db = new DatabaseSync(join(stateDir, databaseName));
const emails = ["vendor-a@example.invalid", "vendor-b@example.invalid", "audit-a@example.invalid"];
const previous = db.prepare(`SELECT id, email, password FROM "User" WHERE email IN (${emails.map(() => "?").join(",")})`).all(...emails);
assert.equal(previous.length, emails.length, "Synthetic local fixture users required");
const password = randomUUID();
const hash = bcrypt.hashSync(password, 8);
for (const user of previous) db.prepare('UPDATE "User" SET "password" = ? WHERE "id" = ?').run(hash, user.id);
let restoredCredentials = false;
function restoreCredentials() {
  if (restoredCredentials) return;
  for (const user of previous) db.prepare('UPDATE "User" SET "password" = ? WHERE "id" = ?').run(user.password, user.id);
  db.close();
  restoredCredentials = true;
}
process.once("SIGINT", () => { restoreCredentials(); process.exit(130); });
process.once("SIGTERM", () => { restoreCredentials(); process.exit(143); });

function cookieJar() {
  const values = new Map();
  return {
    header: () => [...values].map(([name, value]) => `${name}=${value}`).join("; "),
    absorb: (response) => {
      for (const line of response.headers.getSetCookie()) {
        const pair = line.split(";", 1)[0];
        const index = pair.indexOf("=");
        if (index > 0) values.set(pair.slice(0, index), pair.slice(index + 1));
      }
    },
  };
}

async function actionName(route, jar) {
  const response = await localFetch(`${base}${route}`, { headers: { cookie: jar.header() } });
  const html = await response.text();
  const match = /name="(\$ACTION_ID_[^"]+)"/.exec(html);
  assert.ok(match, `No server action form on ${route}`);
  return match[1];
}

async function submitAction(route, jar, action, fields) {
  const form = new FormData();
  form.set(action, "");
  for (const [name, value] of Object.entries(fields)) form.set(name, String(value));
  const response = await localFetch(`${base}${route}`, {
    method: "POST", redirect: "manual", body: form,
    headers: { cookie: jar?.header() ?? "", origin: base },
  });
  const body = await response.text();
  return { status: response.status, location: response.headers.get("location"), error: /Unauthorized|Order not found|Product not found|approved yet|NEXT_REDIRECT/.exec(body)?.[0] ?? null };
}

async function createFixtureCheckout(jar, token) {
  const response = await localFetch(`${base}/api/orders`, {
    method: "POST", headers: { cookie: jar.header(), "content-type": "application/json" },
    body: JSON.stringify({
      checkoutToken: token,
      items: [{ productId: "local-isolation-product-a", quantity: 1, size: "L", color: "As shown" }],
      customer: { name: "Local Test Customer", email: "audit-a@example.invalid", phone: "08000000000", whatsapp: "08000000000", address: "Local fixture address", city: "Lagos", state: "Lagos", size: "L" },
    }),
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}

async function signedIn(email) {
  const jar = cookieJar();
  const csrf = await localFetch(`${base}/api/auth/csrf`, { headers: { cookie: jar.header() } });
  jar.absorb(csrf);
  assert.equal(csrf.status, 200);
  const token = (await csrf.json()).csrfToken;
  const response = await localFetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { cookie: jar.header(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: token, email, password, callbackUrl: `${base}/admin/orders`, json: "true" }),
  });
  jar.absorb(response);
  const session = await localFetch(`${base}/api/auth/session`, { headers: { cookie: jar.header() } });
  const sessionBody = await session.json();
  assert.equal(sessionBody.user?.email, email, `Sign-in failed: ${response.status}`);
  return jar;
}

try {
  const a = await signedIn(emails[0]);
  const b = await signedIn(emails[1]);
  const customer = await signedIn(emails[2]);
  const orderTimings = [];
  for (let i = 0; i < 6; i++) {
    const started = performance.now();
    const response = await localFetch(`${base}/account/orders`, { headers: { cookie: customer.header() } });
    const headersAt = performance.now();
    const html = await response.text();
    if (i > 0) orderTimings.push({ ttfb: Math.round(headersAt - started), total: Math.round(performance.now() - started), bytes: Buffer.byteLength(html) });
  }
  const median = (field) => orderTimings.map((sample) => sample[field]).sort((left, right) => left - right)[2];
  console.log("authenticated account orders baseline", { medianTtfbMs: median("ttfb"), medianTotalMs: median("total"), bytes: median("bytes") });
  for (const [label, jar] of [["vendor A", a], ["vendor B", b], ["customer A", customer]]) {
    const response = await localFetch(`${base}/admin/orders`, { headers: { cookie: jar.header() } });
    const html = await response.text();
    const actionNames = [...html.matchAll(/name="(\$ACTION_[^"]+)"/g)].map((match) => match[1]);
    console.log(label, { status: response.status, actionNames: [...new Set(actionNames)].slice(0, 4), hasBOrder: html.includes("d3fe85d6-7ddd-4e7d-b882-dff723bf423c") });
  }
  for (const route of ["/admin/products", "/admin/products/local-isolation-product-b"]) {
    const response = await localFetch(`${base}${route}`, { headers: { cookie: b.header() } });
    const html = await response.text();
    console.log(route, { formActions: [...new Set([...html.matchAll(/name="(\$ACTION_[^"]+)"/g)].map((match) => match[1]))].slice(0, 8), serializedEditAction: html.includes("7099b0da6a9f065d2c25677f8f6a3b3cbd418142be") });
  }
  const orderId = "d3fe85d6-7ddd-4e7d-b882-dff723bf423c";
  const productId = "local-isolation-product-b";
  const orderAction = await actionName("/admin/orders", b);
  const productAction = await actionName("/admin/products", b);
  const orderBefore = db.prepare('SELECT status, paymentStatus FROM "Order" WHERE id = ?').get(orderId);
  const productBefore = db.prepare('SELECT published, stock, price FROM "Product" WHERE id = ?').get(productId);
  const scenarios = [
    ["vendor A order status", a, "/admin/orders", orderAction, { id: orderId, status: "confirmed", paymentStatus: "paid" }],
    ["vendor A cancellation", a, "/admin/orders", orderAction, { id: orderId, status: "cancelled", paymentStatus: "pending" }],
    ["customer A order mutation", customer, "/admin/orders", orderAction, { id: orderId, status: "cancelled", paymentStatus: "pending" }],
    ["anonymous order mutation", null, "/admin/orders", orderAction, { id: orderId, status: "cancelled", paymentStatus: "pending" }],
    ["vendor A product deletion", a, "/admin/products", productAction, { id: productId }],
    ["customer A product deletion", customer, "/admin/products", productAction, { id: productId }],
    ["anonymous product deletion", null, "/admin/products", productAction, { id: productId }],
  ];
  for (const [label, jar, route, action, fields] of scenarios) {
    const result = await submitAction(route, jar, action, fields);
    assert.ok([302, 500].includes(result.status), `${label}: unexpected HTTP ${result.status}`);
    const orderAfter = db.prepare('SELECT status, paymentStatus FROM "Order" WHERE id = ?').get(orderId);
    const productAfter = db.prepare('SELECT published, stock, price FROM "Product" WHERE id = ?').get(productId);
    assert.deepEqual(orderAfter, orderBefore, `${label} changed another vendor order`);
    assert.deepEqual(productAfter, productBefore, `${label} changed another vendor product`);
    console.log(label, result);
  }
  const storeA = db.prepare('SELECT id, status FROM "Store" WHERE ownerId = ?').get(previous.find((user) => user.email === emails[0]).id);
  db.prepare('UPDATE "Store" SET status = ? WHERE id = ?').run("suspended", storeA.id);
  try {
    const suspendedResult = await submitAction("/admin/products", a, productAction, { id: productId });
    assert.deepEqual(db.prepare('SELECT published, stock, price FROM "Product" WHERE id = ?').get(productId), productBefore);
    console.log("suspended vendor mutation", suspendedResult);
  } finally {
    db.prepare('UPDATE "Store" SET status = ? WHERE id = ?').run(storeA.status, storeA.id);
  }

  const initialStock = db.prepare('SELECT stock FROM "Product" WHERE id = ?').get("local-isolation-product-a").stock;
  assert.ok(initialStock >= 2, "Two units of synthetic stock required");
  const tabState = new Map();
  const tab = { getItem: (key) => tabState.get(key) ?? null, setItem: (key, value) => tabState.set(key, value), removeItem: (key) => tabState.delete(key) };
  const attemptPayload = { items: [{ productId: "local-isolation-product-a", quantity: 1, size: "L", color: "As shown" }], customer: { name: "Local Test Customer", email: "audit-a@example.invalid", phone: "08000000000", whatsapp: "08000000000", address: "Local fixture address", city: "Lagos", state: "Lagos", size: "L" } };
  const token = await checkoutAttemptToken(tab, attemptPayload, randomUUID());
  const afterRefresh = await checkoutAttemptToken(tab, attemptPayload, randomUUID());
  assert.equal(afterRefresh, token);
  const [checkoutOne, checkoutRetry] = await Promise.all([createFixtureCheckout(customer, token), createFixtureCheckout(customer, afterRefresh)]);
  assert.equal(checkoutOne.checkoutId, checkoutRetry.checkoutId);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM "Order" WHERE checkoutId = ?').get(checkoutOne.checkoutId).n, 1);
  assert.equal(db.prepare('SELECT stock FROM "Product" WHERE id = ?').get("local-isolation-product-a").stock, initialStock - 1);
  console.log("authenticated concurrent checkout and simulated refresh", { sameCheckout: true, orders: 1, stockDelta: -1 });

  const secondCheckout = await createFixtureCheckout(customer, randomUUID());
  const firstOrder = db.prepare('SELECT id FROM "Order" WHERE checkoutId = ?').get(checkoutOne.checkoutId).id;
  const secondOrder = db.prepare('SELECT id FROM "Order" WHERE checkoutId = ?').get(secondCheckout.checkoutId).id;
  const vendorAAction = await actionName("/admin/orders", a);
  const cancellations = await Promise.all([
    submitAction("/admin/orders", a, vendorAAction, { id: firstOrder, status: "cancelled", paymentStatus: "pending" }),
    submitAction("/admin/orders", a, vendorAAction, { id: firstOrder, status: "cancelled", paymentStatus: "pending" }),
  ]);
  assert.equal(db.prepare('SELECT status FROM "Order" WHERE id = ?').get(firstOrder).status, "cancelled");
  assert.equal(db.prepare('SELECT stock FROM "Product" WHERE id = ?').get("local-isolation-product-a").stock, initialStock - 1);
  assert.deepEqual(cancellations.map((result) => result.status).sort(), [200, 500]);
  console.log("authenticated concurrent cancellation", cancellations);
  const transitionRace = await Promise.all([
    submitAction("/admin/orders", a, vendorAAction, { id: secondOrder, status: "cancelled", paymentStatus: "pending" }),
    submitAction("/admin/orders", a, vendorAAction, { id: secondOrder, status: "confirmed", paymentStatus: "pending" }),
  ]);
  const secondStatus = db.prepare('SELECT status FROM "Order" WHERE id = ?').get(secondOrder).status;
  assert.ok(["cancelled", "confirmed"].includes(secondStatus));
  const expectedStock = secondStatus === "cancelled" ? initialStock : initialStock - 1;
  assert.equal(db.prepare('SELECT stock FROM "Product" WHERE id = ?').get("local-isolation-product-a").stock, expectedStock);
  assert.ok(transitionRace.some((result) => result.status === 200));
  console.log("authenticated cancellation/confirm race", { results: transitionRace, finalStatus: secondStatus, stock: expectedStock });
  if (secondStatus === "confirmed") {
    await submitAction("/admin/orders", a, vendorAAction, { id: secondOrder, status: "cancelled", paymentStatus: "pending" });
  }
  assert.equal(db.prepare('SELECT stock FROM "Product" WHERE id = ?').get("local-isolation-product-a").stock, initialStock);
} finally {
  restoreCredentials();
}
