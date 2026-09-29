// Read-only local browser rendering audit against a migrated fixture.
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const out = "/tmp/larkvine-ux";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const result = { width, pages: [] };
    for (const [label, path] of [["home", "/"], ["shop", "/shop"], ["stores", "/stores"], ["product", "/isolation-a/isolation-product-a"], ["cart", "/cart"], ["checkout", "/checkout"], ["orders", "/account/orders"]]) {
      const response = await page.goto(`http://localhost:3000${path}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      const measure = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, heading: document.querySelector("h1")?.textContent?.trim() ?? "", imagesWithoutAlt: document.querySelectorAll("img:not([alt])").length }));
      result.pages.push({ label, status: response?.status(), ...measure });
      if ([390, 1440].includes(width) && ["home", "shop", "product", "checkout"].includes(label)) await page.screenshot({ path: `${out}/${label}-${width}.png`, fullPage: false });
    }
    console.log(JSON.stringify(result));
    await context.close();
  }
} finally {
  await browser.close();
}
