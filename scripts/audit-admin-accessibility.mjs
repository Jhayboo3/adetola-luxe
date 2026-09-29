// Automated axe (WCAG 2.2 AA) scan for representative vendor and admin pages.
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import AxeBuilder from "@axe-core/playwright";
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

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  async function scan(email, pages) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const csrf = await context.request.get(`${base}/api/auth/csrf`).then((response) => response.json());
    await context.request.post(`${base}/api/auth/callback/credentials`, { form: { csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/admin`, json: "true" }, maxRedirects: 0 });
    const session = await context.request.get(`${base}/api/auth/session`).then((response) => response.json());
    if (session.user?.email !== email) throw new Error(`Sign-in failed for ${email}`);
    const page = await context.newPage();
    for (const path of pages) {
      await page.goto(`${base}${path}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      console.log(JSON.stringify({ email, path, violations: results.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length, examples: violation.nodes.slice(0, 2).map((node) => node.target.join(" ")) })) }));
    }
    await context.close();
  }
  await scan("vendor-a@example.invalid", ["/admin/dashboard", "/admin/products/new", "/admin/orders", "/admin/store"]);
  await scan("audit.invalid@example.invalid", ["/admin/stores", "/admin/applications"]);
} finally {
  if (browser) await browser.close();
  for (const user of original) db.prepare('UPDATE "User" SET password=? WHERE id=?').run(user.password, user.id);
  db.close();
}
