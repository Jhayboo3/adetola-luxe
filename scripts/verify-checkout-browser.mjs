// Local-only Chrome E2E: server succeeds while the first browser response is
// lost, then a refresh and cloned tab retry the same logical checkout.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { chromium } from "playwright-core";

const base = "http://localhost:3000";
const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const name = readdirSync(dir).find((file) => file.startsWith("db") && file.endsWith(".sqlite"));
if (!name) throw new Error("Local migrated D1 fixture required");
const db = new DatabaseSync(join(dir, name));
const productIds = ["local-isolation-product-a", "local-isolation-product-b"];
const initialStocks = new Map(productIds.map((id) => [id, db.prepare('SELECT stock FROM "Product" WHERE id=?').get(id)?.stock]));
assert.ok([...initialStocks.values()].every((stock) => stock >= 1));
const beforeCheckoutIds = new Set(db.prepare('SELECT id FROM "Checkout"').all().map((row) => row.id));
let browser;

async function fillCheckout(page) {
  await page.getByLabel("Full Name *").fill("Browser Audit Customer");
  await page.getByLabel("Email Address *").fill("browser-audit@example.invalid");
  await page.getByLabel("Phone Number *").fill("08000000000");
  await page.getByLabel("WhatsApp Number *").fill("08000000000");
  await page.getByLabel("Delivery Address *").fill("Local browser fixture address");
  await page.getByLabel("State *").fill("Lagos");
  await page.getByLabel("City *").fill("Lagos");
  await page.getByRole("button", { name: "L", exact: true }).click();
}

try {
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let totalOrderRequests = 0;
  context.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/api/orders")) totalOrderRequests++; });
  await context.route(/https:\/\/(api\.whatsapp|wa\.me|web\.whatsapp)/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(base);
  await page.getByRole("link", { name: "Browse marketplace" }).click();
  await page.waitForURL((url) => url.pathname === "/shop");
  await page.locator("summary").filter({ hasText: "Filter and sort" }).click();
  await page.getByRole("combobox", { name: "Store" }).first().selectOption("isolation-a");
  await page.getByRole("button", { name: "Apply filters" }).first().click();
  await page.waitForURL((url) => url.pathname === "/shop" && url.searchParams.get("store") === "isolation-a");
  await page.getByRole("button", { name: "Search the marketplace" }).click();
  await page.getByPlaceholder("Search products, stores, categories...").fill("Isolation Product A");
  await page.getByPlaceholder("Search products, stores, categories...").press("Enter");
  await page.waitForURL((url) => url.pathname === "/search" && url.searchParams.get("q") === "Isolation Product A");
  await page.getByRole("link", { name: "Isolation Product A" }).first().click();
  await page.waitForURL((url) => url.pathname === "/isolation-a/isolation-product-a");
  await page.getByRole("button", { name: "Add to Cart", exact: true }).first().click();
  await page.goto(`${base}/isolation-b/isolation-product-b`);
  await page.getByRole("button", { name: "Add to Cart", exact: true }).first().click();
  await page.goto(`${base}/cart`);
  assert.ok((await page.content()).includes("Isolation Product A"));
  assert.ok((await page.content()).includes("Isolation Product B"));
  await page.getByRole("heading", { name: "Isolation A" }).waitFor();
  await page.getByRole("heading", { name: "Isolation B" }).waitFor();
  await page.goto(`${base}/checkout`);
  await page.getByRole("heading", { name: "Isolation A" }).waitFor();
  await page.getByRole("heading", { name: "Isolation B" }).waitFor();
  await fillCheckout(page);

  let attempts = 0;
  let firstCheckoutId;
  const firstRoute = async (route) => {
    attempts++;
    const response = await route.fetch();
    const result = await response.json();
    firstCheckoutId = result.checkoutId;
    assert.equal(response.status(), 200, JSON.stringify(result));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.abort("failed"); // simulated lost response after committed write
  };
  await page.route("**/api/orders", firstRoute);
  await page.getByRole("button", { name: "Place order" }).click();
  await page.getByRole("button", { name: "Saving your order..." }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Saving your order..." }).isDisabled(), true);
  await page.getByText("Could not place your order. Please try again.").waitFor();
  await page.unroute("**/api/orders", firstRoute);
  assert.equal(attempts, 1, "Repeated click while pending must not submit twice");
  assert.ok(firstCheckoutId);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM "Order" WHERE checkoutId=?').get(firstCheckoutId).n, 2);
  for (const [id, stock] of initialStocks) assert.equal(db.prepare('SELECT stock FROM "Product" WHERE id=?').get(id).stock, stock - 1);

  await page.reload();
  await fillCheckout(page);
  const tabPromise = page.waitForEvent("popup");
  await page.evaluate(() => { window.open("/checkout", "_blank"); });
  const secondTab = await tabPromise;
  await fillCheckout(secondTab);
  await Promise.all([
    page.getByRole("button", { name: "Place order" }).click(),
    secondTab.getByRole("button", { name: "Place order" }).click(),
  ]);
  await Promise.all([
    page.waitForURL((url) => url.pathname === `/order-confirmation/${firstCheckoutId}`, { timeout: 15000 }),
    secondTab.waitForURL((url) => url.pathname === `/order-confirmation/${firstCheckoutId}`, { timeout: 15000 }),
  ]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM "Order" WHERE checkoutId=?').get(firstCheckoutId).n, 2);
  for (const [id, stock] of initialStocks) assert.equal(db.prepare('SELECT stock FROM "Product" WHERE id=?').get(id).stock, stock - 1);
  await page.reload();
  assert.ok((await page.content()).includes(firstCheckoutId.slice(0, 8).toUpperCase()) || (await page.content()).includes("Isolation Product A"));

  await secondTab.close();
  console.log(JSON.stringify({ checkoutId: firstCheckoutId, initialRequests: attempts, totalOrderRequests, childOrders: 2, stockDeltaPerProduct: -1, refreshAndTwoTabRetry: "same Checkout", receiptRefresh: "pass" }));
} finally {
  if (browser) await browser.close();
  const added = db.prepare('SELECT id FROM "Checkout"').all().map((row) => row.id).filter((id) => !beforeCheckoutIds.has(id));
  for (const checkoutId of added) {
    const orders = db.prepare('SELECT id FROM "Order" WHERE checkoutId=?').all(checkoutId);
    for (const order of orders) {
      db.prepare('DELETE FROM "OrderItem" WHERE orderId=?').run(order.id);
      db.prepare('DELETE FROM "Order" WHERE id=?').run(order.id);
    }
    db.prepare('DELETE FROM "Checkout" WHERE id=?').run(checkoutId);
  }
  for (const [id, stock] of initialStocks) db.prepare('UPDATE "Product" SET stock=? WHERE id=?').run(stock, id);
  db.close();
}
