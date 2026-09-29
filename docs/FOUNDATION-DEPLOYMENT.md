# Larkvine foundation release plan

Status: preparation only. No production release or production data verification has been authorized or performed.

## Preflight and data compatibility

1. Take a restorable D1 backup/export, record row counts and inventory totals, and record current deployed code/migration versions. For an authorized production run, use `npx wrangler d1 export adetola-luxe-db --remote --output <secured-backup-path>` and verify the output can restore into an isolated preview/local D1 before any write freeze. Keep the export access-controlled because it contains customer data. Confirm a recovery operator and maintenance window. This command has **not** been run against production.
2. Read-only audit production data: store statuses, product prices with more than two decimal places or unsafe magnitude, old order total versus line sums, duplicate/nullable IDs, malformed historical statuses, and any order items whose store differs from their order or product. Resolve conflicts before applying guards. Do not round or overwrite historical REAL money automatically.
3. Stage the exact production snapshot in an isolated environment. Apply migrations and rehearse representative customer, vendor and admin workflows against the staged copy. Run tests, typecheck, lint, build and a current online dependency audit before release.
   The currently tested package set uses Next.js 16.3.7 and NextAuth beta.32. The latest local online audit still reports six advisories (three high, three moderate); triage and record the remaining Prisma/deepmerge and development-tool chains before approving release. Do not use `npm audit fix --force` as an unreviewed migration of Prisma or Wrangler.
4. Existing `REAL` amounts remain readable; new minor-unit columns are nullable. Historical Orders have no parent Checkout and remain visible through legacy order history. Legacy high-entropy receipt links remain supported; five-character codes stay disabled. There is no automatic historical money backfill.

## Migration and code sequence

1. Pause checkout, product publication/status changes, vendor order transitions and admin suspension during the cutover. Drain in-flight writes. This controlled window is necessary because old cancellation code plus migration `0012` can restore stock twice, while new code without `0012` can fail to restore it.
2. Apply `0012_order_cancel_inventory_guard.sql`, `0013_checkout_identity.sql`, `0014_money_minor_units.sql`, `0015_order_transition_guards.sql`, `0016_order_item_tenancy.sql`, `0017_checkout_eligibility_guard.sql`, then `0018_catalog_listing_indexes.sql` in that order to production D1. Check each migration result and verify the expected tables, columns, triggers and indexes; stop on an error. `0013` through `0018` also require the updated checkout/catalog code and Prisma client. Do not resume writes between migration and matching code deployment.
3. Deploy the tested code artifact immediately after migrations while writes remain paused. Specifically release `0012` and the updated cancellation action as one operational unit. Confirm Cloudflare bindings and Prisma generated schema correspond to the migrated database.
   Pin and record the exact lockfile and code revision used for the staging rehearsal. A build that merely passes against synthetic rows is insufficient evidence of production-data compatibility.
4. Run smoke tests using dedicated low-value test records: approved-store checkout, multi-store grouping, same-token retry, changed-token-payload conflict, inventory decrement once, cancellation/restock once, denied suspended/unpublished product, signed-in ownership, guest opaque receipt and vendor isolation. Verify order and inventory rows directly, not only HTTP status or page shell.
5. Resume writes only after smoke tests and reconciliation pass. Monitor checkout errors, D1 constraint errors, stock deltas, order counts and vendor-reported status changes. Keep a named owner watching the first release window.

## Rollback and recovery

- Before traffic resumes, a failed migration or smoke test: keep writes paused; restore the preflight D1 backup if necessary, redeploy the previous code artifact, and recheck inventory/order counts. The isolated rehearsal restored a pre-migration backup and detected a partially migrated schema. Production restore has not been rehearsed. SQLite trigger and column changes are not safely reversible by an ad hoc `DROP` in the live database.
- After new orders have been accepted, do **not** deploy old code over the new schema: old cancellation logic would double-restock with `0012`, and old checkout logic cannot understand Checkout/minor-unit invariants. Prefer a forward fix with writes paused. If complete rollback is unavoidable, preserve and reconcile all orders accepted after the backup before restoring it, or those orders would be lost.
- Do not delete new Checkout or minor-unit records to make old code run. Preserve order history, customer receipt access, and inventory allocations.

**Reversible before new writes:** switching the application artifact back after restoring the verified pre-migration backup; restoring the isolated rehearsal backup; removing the two catalog indexes in an isolated copy if they prove costly. **Forward-only once new writes are accepted:** Checkout IDs, new order records, inventory transitions and minor-unit snapshots. Schema changes `0012`–`0017` should be repaired by a reviewed forward migration or full backup restore with reconciliation, not partially reversed on a live database. Detect partial deployment by comparing expected `Checkout` table, minor-unit columns, trigger names and catalog indexes with the deployed code version before resuming writes.

## Financial and inventory verification

For each smoke checkout, verify one Checkout, one Order per Store, item Store/Product tenancy, a single stock decrement, NGN minor-unit item and order sums, and replay without a second decrement. Verify one cancellation transition restores exactly the cancelled quantity; a repeated request and a shipped/delivered cancellation restore zero. Reconcile aggregate inventory before/after the release window. Payment remains WhatsApp/manual and vendor-reported; no provider settlement, commission, balance or payout is verified by this release.

## Runtime compatibility and predeploy gate (2026-09-29)

**Known-good combination (do not change casually):**

| Package | Pinned | Notes |
| --- | --- | --- |
| `next` | `~16.3.7` | 16.3.x patches only. `16.3.x` with `cacheComponents` renders correctly under workerd. |
| `@opennextjs/cloudflare` | `1.20.7` | Exact pin. Required for Next 16.3 on the Workers runtime. |

**Known-bad combination:** `next@16.3.x` + `@opennextjs/cloudflare@1.20.2`. With 1.20.2 the worker's Next cache layer (`CacheSignal` / `createAtomicTimerGroup`) hangs on workerd and every page request fails with a cross-request `IoContext` error ("Cannot perform I/O on behalf of a different request") or a "code had hung and would never generate a response" cancellation. This caused deployment `a58fff9e` to be rolled back on 2026-09-29. Upgrading to 1.20.7 resolved it (`a5cc3fb0`). A residual, non-fatal warning remains: `Next.js cannot guarantee that Cache Components will run as expected due to the current runtime's implementation of setTimeout()`, plus a PPR resume-tree mismatch that makes React fall back to client rendering (React error #419) on some pages; pages remain fully functional.

**Mandatory predeploy runtime check.** Before every `opennextjs-cloudflare deploy`, run:

```
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run verify:worker-runtime   # builds, runs the worker under workerd, requests /, /shop, /stores, /account/orders; fails on 500, hang, or CacheSignal/IoContext signatures
```

`npm run verify:worker-runtime` requires a migrated local D1 (`.wrangler` state). It never deploys and never touches production. Raw `wrangler dev` is deliberately not used — it runs a developer-mode path that can hang independently of production; `opennextjs-cloudflare preview` mirrors the deployed invocation.

**Release sequence:** tests → TypeScript → lint → build → `verify:worker-runtime` → deploy. A passing build alone is not sufficient; the worker must render the critical routes under workerd.
