// Local Chrome viewport audit for vendor and platform-admin pages.
// Uses synthetic D1 accounts; restores passwords afterward. No production data.
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
const original = db.prepare('SELECT id,email,password FROM "User" WHERE email IN (?,?)').all("vendor-a@example.invalid", "audit.invalid@example.invalid");
if (original.length !== 2) throw new Error("Synthetic vendor and platform admin accounts required");
const password = randomUUID();
const hash = bcrypt.hashSync(password, 8);
for (const user of original) db.prepare('UPDATE "User" SET password=? WHERE id=?').run(hash, user.id);

const vendorPages = ["/admin/dashboard", "/admin/products", "/admin/products/new", "/admin/orders", "/admin/categories", "/admin/discounts", "/admin/store"];
const adminPages = ["/admin/applications", "/admin/stores"];

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  async function login(email) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const csrf = await context.request.get(`${base}/api/auth/csrf`).then((response) => response.json());
    await context.request.post(`${base}/api/auth/callback/credentials`, { form: { csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/admin`, json: "true" }, maxRedirects: 0 });
    const session = await context.request.get(`${base}/api/auth/session`).then((response) => response.json());
    if (session.user?.email !== email) throw new Error(`Sign-in failed for ${email}`);
    return context;
  }
  const results = [];
  for (const [role, email, pages] of [["vendor", "vendor-a@example.invalid", vendorPages], ["admin", "audit.invalid@example.invalid", adminPages]]) {
    const context = await login(email);
    const page = await context.newPage();
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of pages) {
        const response = await page.goto(`${base}${path}`);
        await page.waitForLoadState("networkidle").catch(() => {});
        const measure = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
          heading: document.querySelector("h1")?.textContent?.trim() ?? "",
          scrollableTable: Array.from(document.querySelectorAll("div")).some((element) => element.scrollWidth > element.clientWidth + 2 && getComputedStyle(element).overflowX === "auto"),
        }));
        results.push({ role, width, path, status: response?.status(), ...measure, overflow: measure.documentWidth > measure.viewportWidth + 1 });
      }
    }
    await context.close();
  }
  const overflowing = results.filter((result) => result.overflow);
  console.log(JSON.stringify({ checked: results.length, overflowing, sample: results.filter((result) => result.width === 390 && result.role === "vendor") }, null, 2));
} finally {
  if (browser) await browser.close();
  for (const user of original) db.prepare('UPDATE "User" SET password=? WHERE id=?').run(user.password, user.id);
  db.close();
}
