# Foundation compatibility and migration rehearsal

Status: isolated synthetic D1 rehearsal on 2026-09-29. This is **not** a production-data audit. No production export, query, migration or restore was run.

Production-data compatibility gate: **BLOCKED — AUTHORIZED PRODUCTION EXPORT REQUIRED.** Local/staging-safe customer UX work may proceed while this gate is blocked. Release approval still requires the real read-only compatibility audit described below.

## Data examined

An isolated Wrangler D1 state was built with migrations `0001`–`0011`, one synthetic admin and Store, two Products, two historical Orders and two OrderItems. One Order was already cancelled, one had a legacy checkout token, and one Product price had three decimal places. The fixture contains no actual customer information. This deliberately exercises nullable historical columns and ambiguous money; it does not represent production cardinality or anomalies.

| Measure | Before `0012` | After `0017` | Assessment |
| --- | ---: | ---: | --- |
| Users / Stores / Products | 1 / 1 / 2 | 1 / 1 / 2 | No rows disappeared |
| Orders / OrderItems | 2 / 2 | 2 / 2 | History unchanged and readable |
| Inventory snapshots | 4, 3 | 4, 3 | No migration-time stock change |
| Cancelled Orders | 1 | 1 | Historical restock state requires reconciliation; trigger only guards future transitions |
| Legacy Order total sum | ₦24.68 | ₦24.68 | No historical monetary rewrite |
| Orders without Checkout | 2 | 2 | Allowed by nullable FK; cannot infer a parent grouping safely |
| Product prices beyond two decimals | 1 | 1 | Requires manual review; no rounding/backfill |
| Cross-store / orphan OrderItems | 0 / 0 | 0 / 0 | Existing rows safe for the new insert guard |

Both historical Orders and OrderItems have nullable minor-unit fields after migration and require a **separate audited backfill** before integer-only financial reads. One Product price converts exactly to kobo; the other is ambiguous. The legacy raw checkout token has no request fingerprint and cannot be converted into a replayable Checkout identity; the API rejects such retries. The historical cancelled Order cannot be assumed to have been restocked correctly from schema alone.

## Rehearsal result

Wrangler `d1 execute --local --persist-to <isolated-temp-state>` applied `0012`, `0013`, `0014`, `0015`, `0016`, `0017` in that order. Each CLI invocation took roughly 0.66–0.68 seconds including process startup; this is **not** SQL engine execution time or a production migration forecast. Counts, order statuses, legacy totals and inventory matched exactly before and after. The current application code was separately exercised against the migrated local D1 fixture through authenticated checkout, vendor actions and customer history. A pre-migration D1 state backup was copied and restored into a second isolated state; row snapshots and backup hash matched, and the missing Checkout table distinguished the restored schema from the migrated one. No post-write production rollback was attempted.

`0018` catalog indexes were applied to the working local D1 after the foundation rehearsal and measured separately on a 5,009-product isolated copy; see `docs/CATALOG-ARCHITECTURE.md`.

## Production read-only preflight required

Before release, obtain an authorized production export or anonymized copy and report actual totals, not fixture totals. Inspect at least:

- `User`, `Store`, `Product`, `Category`, `Order`, `OrderItem` counts and Store status distribution.
- Product and OrderItem prices whose `value * 100` is not within a documented tolerance of an integer, negative values, unsafe magnitudes, and Order total versus line/shipping/discount sum.
- Order/OrderItem/Product Store ID mismatches, orphan references, null Store IDs, and products tied to unapproved/deleted Stores.
- All historical cancelled Orders with item quantities and current stock; determine whether stock was already restored and whether any cancellation was repeated.
- Existing status strings outside the supported transition map, null/zero totals, duplicate codes/tokens, and legacy customer ownership fields.
- Category slug collisions across Stores and their actual meanings before any shared taxonomy backfill.

Do not silently coerce rows found by this report. Assign ambiguous rows to a review queue and reconcile inventory and financial totals before production migration. Until a real snapshot is examined, counts of production rows requiring backfill, normalization, or manual repair remain **unknown**.
