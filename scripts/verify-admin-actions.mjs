// Local-only verification that platform-admin server actions are protected on
// the server, not merely hidden in the UI. Captures a real bound action POST
// from an admin browser, aborts it, then replays the same request under
// anonymous, customer, vendor and admin identities against the local D1 fixture.
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
const emails = ["audit.invalid@example.invalid", "vendor-a@example.invalid", "vendor-b@example.invalid", "audit-a@example.invalid"];
const users = db.prepare(`SELECT id,email,password FROM "User" WHERE email IN (${emails.map(() => "?").join(",")})`).all(...emails);
assert.equal(users.length, emails.length, "Synthetic admin/vendor/customer accounts required");
const password = randomUUID();
const hash = bcrypt.hashSync(password, 8);
for (const user of users) db.prepare('UPDATE "User" SET password=? WHERE id=?').run(hash, user.id);

// Non-larkvine target so the platform store is untouched.
const target = db.prepare('SELECT id,status,isVerified FROM "Store" WHERE slug=?').get("vendor-b-fixture");
assert.ok(target, "vendor-b-fixture store required");
const targetBefore = { ...target };

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });

  async function contextFor(email) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (email) {
      const csrf = await context.request.get(`${base}/api/auth/csrf`).then((response) => response.json());
      await context.request.post(`${base}/api/auth/callback/credentials`, { form: { csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/admin`, json: "true" }, maxRedirects: 0 });
      const session = await context.request.get(`${base}/api/auth/session`).then((response) => response.json());
      assert.equal(session.user?.email, email, `Sign-in failed for ${email}`);
    }
    return context;
  }

  function rowFor(page, name) {
    return page.locator("h2", { hasText: name }).locator("xpath=ancestor::div[contains(@class,'border-b')][1]");
  }

  async function capture(page, rowName, buttonName, urlPattern) {
    const row = rowFor(page, rowName);
    await row.waitFor({ timeout: 15000 });
    let resolve;
    const captured = new Promise((done) => { resolve = done; });
    const handler = async (route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();
      resolve({ body: request.postDataBuffer(), headers: request.headers() });
      await route.abort();
    };
    await page.route(urlPattern, handler);
    await row.getByRole("button", { name: buttonName }).first().click();
    const request = await Promise.race([captured, new Promise((_, reject) => setTimeout(() => reject(new Error(`${buttonName} POST was not sent`)), 10000))]);
    await page.unroute(urlPattern, handler);
    return request;
  }

  async function replay(context, url, request) {
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([key]) => ["content-type", "next-action", "next-router-state-tree", "accept", "rsc", "x-nextjs-action"].includes(key.toLowerCase())));
    const page = await context.newPage();
    await page.goto(`${base}/`);
    const result = await page.evaluate(async ({ url, headers, bytes }) => {
      const response = await fetch(url, { method: "POST", headers, body: new Uint8Array(bytes), credentials: "same-origin" });
      return { status: response.status, body: (await response.text()).slice(0, 200) };
    }, { url, headers, bytes: [...request.body] });
    await page.close();
    return result;
  }

  const admin = await contextFor(emails[0]);
  const adminPage = await admin.newPage();
  await adminPage.goto(`${base}/admin/stores`);
  await adminPage.getByRole("heading", { name: /All Stores/ }).waitFor({ timeout: 15000 });

  const suspendRequest = await capture(adminPage, "Vendor B Fixture", "Suspend", "**/admin/stores");
  assert.deepEqual({ ...db.prepare('SELECT id,status,isVerified FROM "Store" WHERE id=?').get(target.id) }, targetBefore);

  const identities = [["anonymous", null], ["customer", emails[3]], ["vendor A", emails[1]], ["vendor B (owner)", emails[2]]];
  const denied = [];
  for (const [label, email] of identities) {
    const context = await contextFor(email);
    const result = await replay(context, `${base}/admin/stores`, suspendRequest);
    assert.deepEqual({ ...db.prepare('SELECT id,status,isVerified FROM "Store" WHERE id=?').get(target.id) }, targetBefore, `${label} changed store status`);
    denied.push({ identity: label, status: result.status });
    await context.close();
  }

  const allowed = await replay(admin, `${base}/admin/stores`, suspendRequest);
  const afterSuspend = db.prepare('SELECT status FROM "Store" WHERE id=?').get(target.id);
  assert.equal(afterSuspend.status, "suspended", "valid admin suspension did not apply");
  const verifyCapture = await (async () => {
    await adminPage.reload();
    await adminPage.getByRole("heading", { name: /All Stores/ }).waitFor();
    return capture(adminPage, "Vendor B Fixture", "Verify Store", "**/admin/stores");
  })();
  await replay(admin, `${base}/admin/stores`, verifyCapture);
  const afterVerify = db.prepare('SELECT isVerified FROM "Store" WHERE id=?').get(target.id);
  assert.equal(afterVerify.isVerified, 1, "valid admin verification did not apply");

  const destructiveControls = await adminPage.locator("button, a").filter({ hasText: /delete store|delete permanently/i }).count();
  console.log(JSON.stringify({ denied, allowedAdminSuspend: allowed.status, storeSuspended: afterSuspend.status, storeVerified: afterVerify.isVerified, destructiveStoreControls: destructiveControls }));
} finally {
  if (browser) await browser.close();
  db.prepare('UPDATE "Store" SET status=?, isVerified=? WHERE id=?').run(targetBefore.status, targetBefore.isVerified, target.id);
  for (const user of users) db.prepare('UPDATE "User" SET password=? WHERE id=?').run(user.password, user.id);
  db.close();
}
