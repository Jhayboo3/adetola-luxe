// Automatic expiry of unaccepted orders, so inventory is not held indefinitely.
//
// The reservation window is measured from Order.createdAt (NOT from a WhatsApp
// click): an order must eventually release inventory even if the customer never
// opens WhatsApp. A sweep is request-driven and bounded; a future Cron worker
// can call `sweepExpiredOrders` with `force: true` without changing business
// logic.
//
// Deadline semantics live in `src/lib/reservation.ts` (single source). Every
// mutation path — sweep, Accept, customer Cancel, vendor Reject — must require
// the reservation to still be active, so a delayed sweep can never extend a
// reservation.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { EXPIRABLE_STATUSES } from "@/lib/orders";
import { ORDER_RESERVATION_WINDOW_HOURS, reservationCutoffIso, reservationWindowHours } from "@/lib/reservation";

export { ORDER_RESERVATION_WINDOW_HOURS, reservationWindowHours };

// Small batch + throttle so opportunistic sweeps are cheap when nothing is stale.
export const EXPIRY_BATCH_SIZE = 25;
const EXPIRY_THROTTLE_MS = 5 * 60 * 1000;

// ISO cutoff such that `createdAt > cutoff` ⇔ reservation still active.
export function expiryCutoff(now: number = Date.now()): string {
  return reservationCutoffIso(now, reservationWindowHours());
}

const EXPIRABLE_LIST = EXPIRABLE_STATUSES.map((status) => `'${status}'`).join(",");

// Atomically expire ONE specific order whose reservation deadline has passed.
// The transition is a guarded compare-and-set; the 0019 trigger restores stock
// exactly once and only on the first entry into 'expired'. Returns true when
// this call performed the transition. Optional scope limits which order the
// caller may expire (store ownership / customer ownership).
export async function expireOrderIfStale(
  env: CloudflareEnv,
  id: string,
  scope?: { storeId?: string; userId?: string; now?: number },
): Promise<boolean> {
  const cutoff = expiryCutoff(scope?.now);
  const clauses = [`"id" = ?`];
  const bind: unknown[] = [id];
  if (scope?.storeId) { clauses.push(`"storeId" = ?`); bind.push(scope.storeId); }
  if (scope?.userId) { clauses.push(`"userId" = ?`); bind.push(scope.userId); }
  bind.push(cutoff);
  const updated = await env.DB
    .prepare(`UPDATE "Order" SET "status" = 'expired', "updatedAt" = CURRENT_TIMESTAMP WHERE ${clauses.join(" AND ")} AND "status" IN (${EXPIRABLE_LIST}) AND "createdAt" <= ? RETURNING "id"`)
    .bind(...bind)
    .first<{ id: string }>();
  return Boolean(updated);
}

let lastSweepAt = 0;

// Expire at most `limit` stale, unaccepted orders. Each order transitions with
// its own compare-and-set so a racing vendor acceptance wins outright and is
// never overwritten. Idempotent: a re-run matches nothing.
export async function sweepExpiredOrders(options?: { env?: CloudflareEnv; limit?: number; force?: boolean; now?: number }): Promise<number> {
  const now = options?.now ?? Date.now();
  if (!options?.force && now - lastSweepAt < EXPIRY_THROTTLE_MS) return 0;
  lastSweepAt = now;

  const db = options?.env?.DB ?? (await getCloudflareContext({ async: true })).env.DB;
  const cutoff = expiryCutoff(now);
  const limit = Math.max(1, Math.min(options?.limit ?? EXPIRY_BATCH_SIZE, 100));

  const stale = await db
    .prepare(`SELECT "id" FROM "Order" WHERE "status" IN (${EXPIRABLE_LIST}) AND "createdAt" <= ? ORDER BY "createdAt" ASC LIMIT ?`)
    .bind(cutoff, limit)
    .all<{ id: string }>();

  let expired = 0;
  for (const row of stale.results ?? []) {
    // Shared semantics with `expireOrderIfStale` (same eligible set + deadline).
    const updated = await db
      .prepare(`UPDATE "Order" SET "status" = 'expired', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND "status" IN (${EXPIRABLE_LIST}) AND "createdAt" <= ? RETURNING "id"`)
      .bind(row.id, cutoff)
      .first<{ id: string }>();
    if (updated) expired += 1;
  }
  return expired;
}

// Best-effort opportunistic sweep for request handlers/pages. Never throws, so
// a sweep failure can never break the page that triggered it.
export async function runOpportunisticExpirySweep(): Promise<void> {
  try {
    await sweepExpiredOrders();
  } catch {
    // ignore — expiry is a background maintenance concern
  }
}

// Test/helper hook to reset the module-level throttle.
export function resetExpiryThrottle() {
  lastSweepAt = 0;
}
