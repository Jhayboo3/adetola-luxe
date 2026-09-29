// Local production-mode Chrome checks for customer navigation and dialog focus.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { chromium } from "playwright-core";

const base = "http://localhost:3000";
const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const name = readdirSync(dir).find((file) => file.startsWith("db") && file.endsWith(".sqlite"));
if (!name) throw new Error("Local migrated D1 fixture required");
const db = new DatabaseSync(join(dir, name));
const user = db.prepare('SELECT id,email,password FROM "User" WHERE email=?').get("audit-a@example.invalid");
assert.ok(user, "Synthetic customer required");
const password = randomUUID();
db.prepare('UPDATE "User" SET password=? WHERE id=?').run(bcrypt.hashSync(password, 8), user.id);
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await mobile.newPage();
  await page.goto(base);
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  await menu.click();
  await page.getByRole("dialog", { name: "Site navigation" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog", { name: "Site navigation" }).count(), 0);
  assert.equal(await menu.evaluate((element) => document.activeElement === element), true);
  assert.equal(await page.getByRole("navigation", { name: "Mobile marketplace" }).getByRole("link").count(), 4);

  const search = page.getByRole("button", { name: "Search the marketplace" });
  await search.click();
  await page.getByRole("dialog", { name: "Search the marketplace" }).waitFor();
  assert.equal(await page.getByPlaceholder("Search products, stores, categories...").evaluate((element) => document.activeElement === element), true);
  await page.keyboard.press("Escape");
  assert.equal(await search.evaluate((element) => document.activeElement === element), true);
  await page.getByRole("navigation", { name: "Mobile marketplace" }).getByRole("link", { name: "Shop" }).click();
  await page.waitForURL((url) => url.pathname === "/shop");
  await page.locator("summary").filter({ hasText: "Filter and sort" }).click();
  await page.getByRole("combobox", { name: "Sort" }).first().selectOption("price-asc");
  await page.getByRole("button", { name: "Apply filters" }).first().click();
  await page.waitForURL((url) => url.searchParams.get("sort") === "price-asc");
  await page.goBack();
  await page.waitForURL((url) => url.searchParams.get("sort") === null, { timeout: 5000 });
  await page.goForward();
  await page.waitForURL((url) => url.searchParams.get("sort") === "price-asc", { timeout: 5000 });
  assert.equal(new URL(page.url()).searchParams.get("sort"), "price-asc");

  const csrf = await mobile.request.get(`${base}/api/auth/csrf`).then((response) => response.json());
  await mobile.request.post(`${base}/api/auth/callback/credentials`, { form: { csrfToken: csrf.csrfToken, email: user.email, password, callbackUrl: `${base}/account/orders`, json: "true" }, maxRedirects: 0 });
  const session = await mobile.request.get(`${base}/api/auth/session`).then((response) => response.json());
  assert.equal(session.user?.email, user.email);
  await page.goto(`${base}/account/orders`);
  await page.getByRole("heading", { name: "My Orders" }).waitFor();
  assert.ok((await page.content()).includes("Checkout #") || (await page.content()).includes("Earlier Orders"));

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(base);
  const nav = desktopPage.getByRole("navigation", { name: "Marketplace", exact: true });
  await nav.getByRole("link", { name: "Shop" }).waitFor();
  console.log("desktop nav", await nav.getByRole("link").allTextContents());
  for (const label of ["Shop", "Stores", "Orders", "Sign in"]) assert.equal(await nav.getByRole("link", { name: label }).isVisible(), true, label);
  assert.equal(await desktopPage.getByRole("button", { name: "Search the marketplace" }).isVisible(), true);
  console.log(JSON.stringify({ mobileMenu: "pass", searchFocus: "pass", filterHistory: "pass", authenticatedOrderHistory: "pass", desktopNavigation: "pass" }));
} finally {
  if (browser) await browser.close();
  db.prepare('UPDATE "User" SET password=? WHERE id=?').run(user.password, user.id);
  db.close();
}
