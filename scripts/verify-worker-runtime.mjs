// Worker-runtime regression and predeploy gate.
//
// Prepares a migrated LOCAL D1, builds the production Cloudflare worker, launches
// it under workerd via `opennextjs-cloudflare preview` (the production-
// representative invocation) and requests critical routes with a hard timeout.
//
// FAILS (exit 1) on:
//   - a request that hangs / times out
//   - HTTP >= 500
//   - the known Next 16.3 / OpenNext cache-runtime signatures that caused the
//     failed a58fff9e deployment:
//       "Cannot perform I/O on behalf of a different request" (cross-request IoContext)
//       CacheSignal / createAtomicTimerGroup / IoContext
//       "code had hung and would never generate a response"
//   - marketplace content served on the love.larkvine.org host (isolation guard)
//
// The known non-fatal PPR resume mismatch (React error #419) and the Next
// Cache Components setTimeout warning are counted and reported separately but do
// NOT fail the gate (see docs/FOUNDATION-DEPLOYMENT.md).
//
// Note: raw `wrangler dev` is NOT used — it runs a developer-mode path that can
// hang independently of production. The gate never deploys and never touches
// production.
import { spawn } from "node:child_process";
import http from "node:http";

const PORT = Number(process.env.WORKER_RUNTIME_PORT ?? 8799);
const BASE = `http://127.0.0.1:${PORT}`;
// Accept 2xx/3xx and 404 (a fixture may be absent on an already-provisioned
// local DB); fail only on 5xx.
const ROUTES = ["/", "/shop", "/stores", "/account/orders", "/cart", "/checkout", "/runtime-check/runtime-check-product"];
const REQUEST_TIMEOUT_MS = 45_000;
const READY_TIMEOUT_MS = 150_000;
const BUILD_TIMEOUT_MS = 600_000;
const REQUEST_ATTEMPTS = 3;
const FATAL_SIGNATURES = [
  /CacheSignal/,
  /createAtomicTimerGroup/,
  /Cannot perform I\/O on behalf of a different request/,
  /different request's handler/,
  /code had hung and would never generate a response/,
  /IoContext/,
];
const MARKETPLACE_MARKERS = ["Shop the marketplace", "Marketplace Stores", "Find something worth keeping"];

const sh = (command, args, options = {}) => new Promise((resolve) => {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const timer = setTimeout(() => child.kill("SIGKILL"), options.timeout ?? BUILD_TIMEOUT_MS);
  child.on("exit", (code) => { clearTimeout(timer); resolve({ code, output }); });
});

async function waitForChildReady(child, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(4000) });
      if (response.status > 0) return true;
    } catch { /* not up yet */ }
    if (child.exitCode !== null) return false;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

async function request(path) {
  // A single cold request can be slow (first-hit compilation / cache fill).
  // Retry before declaring a hang so the gate is not flaky; a persistent hang
  // still fails every attempt.
  let last = { path, status: null, elapsedMs: 0, error: "not attempted" };
  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      return { path, status: response.status, elapsedMs: Date.now() - started, attempts: attempt };
    } catch (error) {
      last = { path, status: null, elapsedMs: Date.now() - started, attempts: attempt, error: String(error).slice(0, 160) };
    }
  }
  return last;
}

function hostRequest(path, host) {
  return new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port: PORT, path, method: "GET", headers: { Host: host } }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: body.slice(0, 4000) }));
    });
    req.on("error", (error) => resolve({ status: null, error: String(error).slice(0, 160) }));
    req.setTimeout(REQUEST_TIMEOUT_MS, () => { req.destroy(); resolve({ status: null, error: "timeout" }); });
    req.end();
  });
}

const report = { steps: [], routes: [], loveHost: {}, failures: [], signatures: [], pprWarnings: 0, setTimeoutWarnings: 0, ok: false };
const progress = (message) => process.stderr.write(`[worker-runtime] ${message}\n`);

// 0. Ensure a migrated local D1 exists.
progress("preparing local D1…");
const prepared = await sh("node", ["scripts/prepare-local-d1.mjs"], { timeout: 300_000 });
report.steps.push({ step: "prepare-d1", code: prepared.code });
if (prepared.code !== 0) {
  report.failures.push("local D1 preparation failed");
  report.prepareTail = prepared.output.slice(-1000);
  console.log(JSON.stringify(report, null, 1));
  process.exit(1);
}

// 1. Build the production worker.
progress("building production worker…");
const build = await sh("npx", ["opennextjs-cloudflare", "build"], { timeout: BUILD_TIMEOUT_MS });
report.steps.push({ step: "build", code: build.code });
if (build.code !== 0) {
  report.failures.push(`build failed (exit ${build.code})`);
  report.buildTail = build.output.slice(-1500);
  console.log(JSON.stringify(report, null, 1));
  process.exit(1);
}
progress("build complete");

// 2. Launch under workerd and capture logs.
let logBuffer = "";
const dev = spawn("npx", ["opennextjs-cloudflare", "preview", "--port", String(PORT)], { stdio: ["ignore", "pipe", "pipe"], detached: true });
dev.stdout.on("data", (chunk) => { logBuffer += chunk; });
dev.stderr.on("data", (chunk) => { logBuffer += chunk; });
const kill = () => {
  // Kill the whole process group (preview -> wrangler dev -> workerd), otherwise
  // orphaned children keep stdio open and the script never exits.
  try { process.kill(-dev.pid, "SIGKILL"); } catch { /* already gone */ }
  try { dev.kill("SIGKILL"); } catch { /* ignore */ }
};
process.once("SIGINT", () => { kill(); process.exit(130); });
process.once("SIGTERM", () => { kill(); process.exit(143); });

try {
  progress(`starting preview on ${BASE} …`);
  const ready = await waitForChildReady(dev, READY_TIMEOUT_MS);
  report.steps.push({ step: "worker-ready", ready });
  progress(`worker ready: ${ready}`);
  if (!ready) {
    report.failures.push("worker did not become ready within timeout");
  } else {
    // Warm up the worker so the first measured route is not charged for cold
    // compilation / cache population. The result is not a pass/fail signal.
    progress("warming up…");
    await request("/");
    for (const route of ROUTES) {
      const result = await request(route);
      progress(`${route} -> ${result.status} (${result.elapsedMs}ms, ${result.attempts} attempt(s))`);
      report.routes.push(result);
    }
    // Love subdomain isolation: the marketplace must never render on that host.
    for (const path of ["/", "/anything", "/shop"]) {
      const love = await hostRequest(path, "love.larkvine.org");
      const leaked = MARKETPLACE_MARKERS.filter((marker) => love.body?.includes(marker));
      report.loveHost[path] = { status: love.status, marketplaceLeaked: leaked };
      if (leaked.length) report.failures.push(`love host ${path} exposed marketplace: ${leaked.join(", ")}`);
    }
    const love = await hostRequest("/love", "localhost");
    if (love.status !== 200) report.failures.push(`/love returned HTTP ${love.status}`);
  }
} finally {
  kill();
}

// 3. Evaluate.
for (const route of report.routes) {
  if (route.status === null) report.failures.push(`${route.path}: request failed/timed out after ${route.attempts} attempts (${route.error})`);
  else if (route.status >= 500) report.failures.push(`${route.path}: HTTP ${route.status}`);
}
report.pprWarnings = (logBuffer.match(/resume to render/g) ?? []).length;
report.setTimeoutWarnings = (logBuffer.match(/implementation of `setTimeout\(\)`/g) ?? []).length;
for (const pattern of FATAL_SIGNATURES) {
  if (pattern.test(logBuffer)) report.signatures.push(String(pattern));
}
if (report.signatures.length) report.failures.push(`runtime signature(s) detected: ${report.signatures.join(", ")}`);

report.ok = report.failures.length === 0;
console.log(JSON.stringify(report, null, 1));
if (!report.ok) {
  console.error("\nWORKER RUNTIME CHECK FAILED");
  for (const failure of report.failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.error(`\nWORKER RUNTIME CHECK PASSED (non-fatal PPR warnings: ${report.pprWarnings}, setTimeout warnings: ${report.setTimeoutWarnings})`);
process.exit(0);
