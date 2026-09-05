/*
 * Prewarm the R2 incremental cache after a deploy so real visitors hit warm
 * entries instead of expensive cold cache-misses (which can exceed the
 * Cloudflare Free plan's 10ms CPU budget and cause Error 1102).
 *
 * Usage:  python-free, plain node
 *   node scripts/prewarm.mjs                 # uses PREWARM_URL or the workers.dev default
 *   PREWARM_URL="https://example.com" node scripts/prewarm.mjs
 */
const BASE = (process.env.PREWARM_URL || "https://larkvine.jeremiahoshiokhame.workers.dev").replace(/\/$/, "");

const STATIC = [
  "/",
  "/about",
  "/contact",
  "/privacy",
  "/services",
  "/terms",
  "/shop",
  "/search",
  "/stores",
  "/sell",
  "/cart",
  "/login",
  "/signup",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function hit(path, log = true) {
  const url = BASE + path;
  const start = Date.now();
  const res = await fetch(url, { redirect: "manual" });
  const ms = Date.now() - start;
  const tag = res.status >= 200 && res.status < 300 ? "OK " : "ERR";
  if (log) console.log(`${tag} ${res.status}  ${String(ms).padStart(5)}ms  ${url}`);
  return res;
}

async function findSlugs(html, kind) {
  const slugs = new Set();
  const re = kind === "store" ? /href="\/([a-z0-9][a-z0-9-]*)"[^>]*>/g : /href="\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const slug = kind === "store" ? m[1] : `${m[1]}/${m[2]}`;
    if (!/^(shop|stores|about|contact|terms|privacy|services|search|sell|cart|login|signup|account|checkout|order|admin)/.test(slug)) {
      slugs.add(slug);
    }
  }
  return [...slugs];
}

async function main() {
  console.log(`Prewarming ${BASE} ...\n`);
  for (const p of STATIC) await hit(p);

  // Discover storefront slugs from the stores directory + homepage.
  const storeHtml = await (await fetch(BASE + "/stores")).text();
  const homeHtml = await (await fetch(BASE + "/")).text();
  const storeSlugs = new Set([...await findSlugs(storeHtml, "store"), ...await findSlugs(homeHtml, "store")]);
  console.log(`\nFound ${storeSlugs.size} storefront(s).`);
  for (const slug of storeSlugs) {
    const page = `/${slug}`;
    await hit(page);
    await sleep(300);
    const html = await (await fetch(BASE + page)).text();
    const products = await findSlugs(html, "product");
    for (const prod of products.slice(0, 12)) {
      await hit(`/${prod}`);
      await sleep(150);
    }
  }
  console.log("\nPrewarm complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
