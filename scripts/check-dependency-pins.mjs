// Dependency compatibility guard. Fails if the known-good runtime pair is
// changed or silently downgraded.
//
//   KNOWN GOOD: next 16.3.x + @opennextjs/cloudflare 1.20.7
//   KNOWN BAD:  next 16.3.x + @opennextjs/cloudflare 1.20.2  (workerd hang)
//
// See docs/FOUNDATION-DEPLOYMENT.md. The purpose is to catch accidental
// regression during dependency updates, not to block intentional upgrades.
import { readFileSync } from "node:fs";

const APPROVED_OPENNEXT = "1.20.7";
const APPROVED_NEXT_MAJOR_MINOR = "16.3.";
const APPROVED_NEXT_RANGE = "~16.3.7";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));

const failures = [];

const opennextRange = pkg.devDependencies?.["@opennextjs/cloudflare"];
if (opennextRange !== APPROVED_OPENNEXT) {
  failures.push(`package.json @opennextjs/cloudflare must be pinned to ${APPROVED_OPENNEXT} (found ${opennextRange})`);
}
const opennextResolved = lock.packages?.["node_modules/@opennextjs/cloudflare"]?.version;
if (opennextResolved !== APPROVED_OPENNEXT) {
  failures.push(`lockfile @opennextjs/cloudflare must resolve to ${APPROVED_OPENNEXT} (found ${opennextResolved})`);
}

const nextRange = pkg.dependencies?.next;
if (nextRange !== APPROVED_NEXT_RANGE) {
  failures.push(`package.json next must be ${APPROVED_NEXT_RANGE} (found ${nextRange})`);
}
const nextResolved = lock.packages?.["node_modules/next"]?.version;
if (!nextResolved?.startsWith(APPROVED_NEXT_MAJOR_MINOR)) {
  failures.push(`lockfile next must resolve within ${APPROVED_NEXT_MAJOR_MINOR}x (found ${nextResolved})`);
}

if (failures.length) {
  console.error("DEPENDENCY PIN CHECK FAILED");
  for (const failure of failures) console.error(` - ${failure}`);
  console.error("\nIf this change is intentional, update scripts/check-dependency-pins.mjs and the compatibility note in docs/FOUNDATION-DEPLOYMENT.md, and re-run npm run verify:worker-runtime.");
  process.exit(1);
}
console.log(`dependency pins OK: next ${nextResolved}, @opennextjs/cloudflare ${opennextResolved}`);
