// Semantic + keyboard accessibility inspection for the customer surfaces.
// Complements the axe scan (audit-accessibility.mjs) with landmark, heading,
// accessible-name, tab-order and dialog focus checks. No screen reader is
// driven; this cannot stand in for a human assistive-technology pass.
import { chromium } from "playwright-core";

const base = "http://localhost:3000";
const pages = [["home", "/"], ["shop", "/shop"], ["stores", "/stores"], ["product", "/isolation-a/isolation-product-a"], ["cart", "/cart"]];
const report = [];

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  for (const [label, path] of pages) {
    await page.goto(`${base}${path}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    const structure = await page.evaluate(() => {
      const names = (elements) => Array.from(elements).map((element) => ({
        tag: element.tagName.toLowerCase(),
        name: element.getAttribute("aria-label") || element.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) || element.getAttribute("title") || "",
      }));
      const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((heading) => ({ level: Number(heading.tagName[1]), text: heading.textContent?.trim().slice(0, 50) ?? "" }));
      const focusable = Array.from(document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null);
      const unnamedInteractive = focusable.filter((element) => {
        const text = element.textContent?.trim() ?? "";
        const labelled = element.labels?.length > 0 || element.closest("label") !== null || element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || element.getAttribute("title") || element.getAttribute("placeholder");
        return !text && !labelled;
      }).map((element) => element.tagName.toLowerCase() + (element.getAttribute("type") ? `[${element.getAttribute("type")}]` : ""));
      return {
        landmarks: names(document.querySelectorAll("header, nav, main, footer, [role=main], [role=navigation], [role=banner], [role=contentinfo]")),
        mainCount: document.querySelectorAll("main, [role=main]").length,
        headings,
        imagesWithoutAlt: document.querySelectorAll("img:not([alt])").length,
        imagesWithEmptyAlt: document.querySelectorAll('img[alt=""]').length,
        unnamedInteractive,
        focusableCount: focusable.length,
      };
    });
    let previous = 0; const headingSkips = [];
    for (const heading of structure.headings) { if (previous && heading.level > previous + 1) headingSkips.push(`h${previous}->h${heading.level}`); previous = heading.level; }
    report.push({ page: label, main: structure.mainCount, landmarks: structure.landmarks.length, headingSkips, imagesWithoutAlt: structure.imagesWithoutAlt, unnamedInteractive: structure.unnamedInteractive, focusableCount: structure.focusableCount });
  }

  // Keyboard-only traversal: Tab through the product page and confirm each
  // focused element has a visible focus indicator (outline or box-shadow).
  await page.goto(`${base}/isolation-a/isolation-product-a`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.body.focus());
  const tabOrder = []; let noVisibleFocus = 0; const invisibleFocus = [];
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    const entry = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      const visible = (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
      return { tag: element.tagName.toLowerCase(), name: (element.getAttribute("aria-label") || element.textContent?.trim().replace(/\s+/g, " ").slice(0, 40) || element.getAttribute("placeholder") || element.getAttribute("name") || ""), visible, className: typeof element.className === "string" ? element.className.slice(0, 80) : "" };
    });
    if (!entry) break;
    if (!entry.visible) { noVisibleFocus++; invisibleFocus.push(entry); }
    tabOrder.push(entry.tag);
  }

  // Dialog focus: mobile menu traps Tab and restores focus on Escape.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(base);
  const trigger = mobilePage.getByRole("button", { name: "Open navigation menu" });
  await trigger.click();
  const dialog = mobilePage.getByRole("dialog", { name: "Site navigation" });
  await dialog.waitFor();
  const focusInside = await mobilePage.evaluate(() => document.querySelector('[role=dialog]')?.contains(document.activeElement) ?? false);
  await mobilePage.keyboard.press("Shift+Tab");
  const stillInside = await mobilePage.evaluate(() => document.querySelector('[role=dialog]')?.contains(document.activeElement) ?? false);
  await mobilePage.keyboard.press("Escape");
  const restored = await trigger.evaluate((element) => document.activeElement === element);

  console.log(JSON.stringify({ report, keyboard: { tabOrder, noVisibleFocus, invisibleFocus }, dialog: { focusInside, focusStaysInsideOnShiftTab: stillInside, focusRestoredOnEscape: restored } }, null, 2));
} finally {
  if (browser) await browser.close();
}
