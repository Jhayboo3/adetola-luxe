// Functional local baseline against a migrated D1 fixture, not production Web Vitals.
import { performance } from "node:perf_hooks";

const base = process.env.LARKVINE_TEST_BASE_URL ?? "http://127.0.0.1:3000";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error("Local server URL required");
const routes = ["/", "/shop", "/search?q=local", "/stores", "/isolation-a", "/isolation-a/isolation-product-a", "/cart", "/checkout"];

async function measure(route) {
  const start = performance.now();
  const response = await fetch(`${base}${route}`, { redirect: "manual" });
  const headersAt = performance.now();
  const body = await response.arrayBuffer();
  const end = performance.now();
  return { status: response.status, ttfbMs: Math.round(headersAt - start), totalMs: Math.round(end - start), bytes: body.byteLength, hasErrorBoundary: new TextDecoder().decode(body).includes("NEXT_HTTP_ERROR_FALLBACK") };
}

for (const route of routes) {
  await measure(route); // warm compilation and route data
  const samples = [];
  for (let i = 0; i < 5; i++) samples.push(await measure(route));
  const median = (name) => samples.map((sample) => sample[name]).sort((a, b) => a - b)[2];
  console.log(JSON.stringify({ route, status: samples[0].status, medianTtfbMs: median("ttfbMs"), medianTotalMs: median("totalMs"), bytes: median("bytes"), errorBoundary: samples.some((sample) => sample.hasErrorBoundary) }));
}
