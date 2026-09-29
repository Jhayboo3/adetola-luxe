// Read-only production browser smoke. Drives real Chrome against the public
// site, records console/network errors and known Workers runtime signatures,
// and checks layout overflow. Does not submit orders.
import { chromium } from "playwright-core";

const base = process.env.LARKVINE_SMOKE_BASE ?? "https://www.larkvine.org";
const SIGNATURES = /CacheSignal|createAtomicTimerGroup|IoContext|Cannot perform I\/O on behalf of a different request|Worker.*hung/i;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const results = [];

function attach(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];
  const failed = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300)); });
  page.on("pageerror", (error) => pageErrors.push(String(error.message).slice(0, 300)));
  page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url().slice(0, 140)}`); });
  page.on("requestfailed", (request) => failed.push(`${request.failure()?.errorText ?? "failed"} ${request.url().slice(0, 140)}`));
  return { consoleErrors, pageErrors, badResponses, failed };
}

async function visit(page, path, label) {
  const started = Date.now();
  let status = null;
  let error = null;
  try {
    const response = await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    status = response?.status() ?? null;
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  } catch (cause) {
    error = String(cause).slice(0, 200);
  }
  const elapsed = Date.now() - started;
  const measure = await page.evaluate(() => ({
    title: document.title,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    visibleMains: [...document.querySelectorAll("main")].filter((element) => element.offsetParent !== null).length,
    h1: document.querySelector("h1")?.textContent?.trim().slice(0, 60) ?? "",
    cards: document.querySelectorAll("article").length,
    brokenImages: [...document.querySelectorAll("img")].filter((image) => image.complete && image.naturalWidth === 0).length,
    bodyText: document.body.innerText.slice(0, 120),
  })).catch(() => ({}));
  return { label, path, status, elapsedMs: elapsed, error, ...measure };
}

// --- Desktop ---
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const signals = attach(page);
  for (const [label, path] of [["home", "/"], ["shop", "/shop"], ["stores", "/stores"], ["orders", "/account/orders"], ["cart", "/cart"], ["checkout", "/checkout"]]) {
    const result = await visit(page, path, label);
    results.push(result);
  }
  // Discover a product from the shop and exercise product + add-to-cart.
  await page.goto(`${base}/shop`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const productHref = await page.evaluate(() => {
    const anchor = [...document.querySelectorAll('main a[href]')].find((element) => /^\/[^/]+\/[^/]+$/.test(element.getAttribute("href") || ""));
    return anchor?.getAttribute("href") ?? null;
  });
  if (productHref) {
    const product = await visit(page, productHref, "product");
    results.push(product);
    const addButton = page.getByRole("button", { name: /Add to [Cc]art|Add \d+ to Cart/ }).first();
    const sizeButton = page.locator('button[aria-pressed]').first();
    try {
      if (await sizeButton.count()) await sizeButton.click();
      await addButton.click({ timeout: 8000 });
      await page.waitForTimeout(800);
    } catch (cause) {
      results.push({ label: "add-to-cart", error: String(cause).slice(0, 160) });
    }
    const cart = await visit(page, "/cart", "cart-after-add");
    results.push(cart);
  } else {
    results.push({ label: "product", error: "no product link found on /shop" });
  }
  const signalHits = [...signals.consoleErrors, ...signals.pageErrors, ...signals.badResponses].filter((line) => SIGNATURES.test(line));
  results.push({ label: "desktop-signals", consoleErrors: signals.consoleErrors.length, pageErrors: signals.pageErrors.length, badResponses: signals.badResponses.slice(0, 8), failed: signals.failed.slice(0, 8), signatureHits: signalHits, consoleSamples: signals.consoleErrors.slice(0, 5), pageErrorSamples: signals.pageErrors.slice(0, 5) });
  await context.close();
}

// --- Mobile ---
for (const width of [390, 430]) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const signals = attach(page);
  const mobile = [];
  for (const [label, path] of [["home", "/"], ["shop", "/shop"], ["stores", "/stores"], ["cart", "/cart"], ["checkout", "/checkout"]]) {
    mobile.push(await visit(page, path, label));
  }
  const productHref = await page.goto(`${base}/shop`, { waitUntil: "domcontentloaded", timeout: 30000 }).then(async () => {
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    return page.evaluate(() => [...document.querySelectorAll('main a[href]')].find((element) => /^\/[^/]+\/[^/]+$/.test(element.getAttribute("href") || ""))?.getAttribute("href") ?? null);
  }).catch(() => null);
  if (productHref) {
    const product = await visit(page, productHref, "product");
    const sticky = await page.evaluate(() => document.querySelector('div.fixed.md\\:hidden') !== null).catch(() => null);
    product.stickyCta = sticky;
    mobile.push(product);
  }
  const overflow = mobile.filter((entry) => (entry.documentWidth ?? 0) > width + 1).map((entry) => ({ label: entry.label, documentWidth: entry.documentWidth }));
  const signalHits = [...signals.consoleErrors, ...signals.pageErrors].filter((line) => SIGNATURES.test(line));
  results.push({ label: `mobile-${width}`, pages: mobile, overflow, signatureHits: signalHits });
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ base, results }, null, 1));
