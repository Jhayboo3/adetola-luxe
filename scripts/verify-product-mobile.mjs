// Local Chrome check for the product-detail mobile sticky purchase control.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = "http://localhost:3000";
const product = `${base}/isolation-a/isolation-product-a`;

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await mobile.newPage();
  await page.goto(product);
  await page.getByRole("heading", { name: "Isolation Product A" }).waitFor();

  const nav = page.getByRole("navigation", { name: "Mobile marketplace" });
  const sticky = page.locator("div.fixed.md\\:hidden").filter({ has: page.getByRole("button", { name: /Add to cart|Added/ }) });
  await sticky.waitFor({ state: "visible" });

  const navBox = await nav.boundingBox();
  const stickyBox = await sticky.boundingBox();
  assert.ok(navBox && stickyBox, "nav and sticky control must be laid out");
  assert.ok(Math.abs(stickyBox.y + stickyBox.height - navBox.y) <= 1, `sticky bottom ${stickyBox.y + stickyBox.height} must meet nav top ${navBox.y}`);
  assert.ok(stickyBox.y + stickyBox.height <= 844, "sticky control must be on screen");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  const afterScroll = await sticky.boundingBox();
  assert.ok(afterScroll && Math.abs(afterScroll.y - stickyBox.y) <= 1, "sticky control should stay fixed while scrolling");

  await page.getByRole("button", { name: /Add to cart/ }).click();
  await page.getByText(/Added .* to your cart/).waitFor({ timeout: 3000 });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("larkvine-cart") ?? "{}").state?.items?.length ?? 0), 1);

  const desktop = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(product);
  await desktopPage.getByRole("heading", { name: "Isolation Product A" }).waitFor();
  assert.equal(await desktopPage.locator("div.fixed.md\\:hidden").filter({ has: desktopPage.getByRole("button", { name: /Add to cart/ }) }).count(), 0, "sticky control must be mobile-only");

  console.log(JSON.stringify({ stickyAboveNav: true, stickyFixedOnScroll: true, mobileAddToCart: "pass", desktopHidden: true }));
} finally {
  if (browser) await browser.close();
}
