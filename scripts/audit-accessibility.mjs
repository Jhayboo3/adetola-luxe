// Local fixture automated accessibility scan; supplements keyboard/manual QA.
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const [label, path] of [["home", "/"], ["shop", "/shop"], ["stores", "/stores"], ["product", "/isolation-a/isolation-product-a"]]) {
      await page.goto(`http://localhost:3000${path}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      console.log(JSON.stringify({ width, page: label, violations: results.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length, examples: violation.nodes.slice(0, 2).map((node) => node.target.join(" ")) })) }));
    }
    await context.close();
  }
} finally {
  await browser.close();
}
