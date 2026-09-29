// Worker-runtime regression and predeploy gate.
//
// Builds the production Cloudflare worker, launches it locally under workerd
// (opennextjs-cloudflare preview, the production-representative invocation) and
// requests critical routes with a hard timeout. Fails (exit 1) if a route hangs,
// returns >= 500, or the worker logs the known Next 16.3 / OpenNext cache-runtime
// signatures that caused the failed a58fff9e deployment:
//   - "Cannot perform I/O on behalf of a different request" (cross-request IoContext)
//   - CacheSignal / createAtomicTimerGroup / IoContext
//   - "code had hung and would never generate a response"
//
// Note: raw `wrangler dev` is NOT used — it runs a developer-mode path that can
// hang independently of production. `opennextjs-cloudflare preview` mirrors the
// deployed invocation (wrangler dev --local plus the adapter's env handling).
//
// Requires a migrated LOCAL D1 (.wrangler state) — the same fixture used by the
// other verification scripts. It never touches production and never deploys.
import { spawn } from "node:child_process";

const PORT = Number(process.env.WORKER_RUNTIME_PORT ?? 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const ROUTES = ["/", "/shop", "/stores", "/account/orders"];
const REQUEST_TIMEOUT_MS = 30_000;
const READY_TIMEOUT_MS = 150_000;
const BUILD_TIMEOUT_MS = 600_000;
const SIGNATURES = [
  /CacheSignal/,
  /createAtomicTimerGroup/,
  /Cannot perform I\/O on behalf of a different request/,
  /different request's handler/,
  /code had hung and would never generate a response/,
  /IoContext/,
];

const sh = (command, args, options = {}) => new Promise((resolve) => {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; options.onData?.(String(chunk)); });
  child.stderr.on("data", (chunk) => { output += chunk; options.onData?.(String(chunk)); });
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
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const body = (await response.text()).slice(0, 4000);
    return { path, status: response.status, elapsedMs: Date.now() - started, body };
  } catch (error) {
    return { path, status: null, elapsedMs: Date.now() - started, error: String(error).slice(0, 160) };
  }
}

const report = { steps: [], routes: [], failures: [], signatures: [], ok: false };
const progress = (message) => process.stderr.write(`[worker-runtime] ${message}\n`);

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
    for (const route of ROUTES) {
      const result = await request(route);
      progress(`${route} -> ${result.status} (${result.elapsedMs}ms)`);
      report.routes.push(result);
    }
  }
} finally {
  kill();
}

// 3. Evaluate.
for (const route of report.routes) {
  if (route.status === null) report.failures.push(`${route.path}: request failed/timed out (${route.error})`);
  else if (route.status >= 500) report.failures.push(`${route.path}: HTTP ${route.status}`);
}
const combined = `${JSON.stringify(report.routes)}\n${logBuffer}`;
for (const pattern of SIGNATURES) {
  if (pattern.test(combined)) report.signatures.push(String(pattern));
}
if (report.signatures.length) report.failures.push(`runtime signature(s) detected: ${report.signatures.join(", ")}`);

report.ok = report.failures.length === 0;
console.log(JSON.stringify({ ...report, routes: report.routes.map(({ path, status, elapsedMs }) => ({ path, status, elapsedMs })) }, null, 1));
if (!report.ok) {
  console.error("\nWORKER RUNTIME CHECK FAILED");
  for (const failure of report.failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.error("\nWORKER RUNTIME CHECK PASSED");
process.exit(0);
