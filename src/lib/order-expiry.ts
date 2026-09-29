// Automatic expiry of unaccepted orders, so inventory is not held indefinitely.
//
// The reservation window is measured from Order.createdAt (NOT from a WhatsApp
// click): an order must eventually release inventory even if the customer never
// opens WhatsApp. A sweep is request-driven and bounded; a future Cron worker
// can call `sweepExpiredOrders` with `force: true` without changing business
// logic.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { EXPIRABLE_STATUSES } from "@/lib/orders";

// Central configuration. Do not hard-code the window elsewhere.
export const ORDER_RESERVATION_WINDOW_HOURS = 12;

// Small batch + throttle so opportunistic sweeps are cheap when nothing is stale.
export const EXPIRY_BATCH_SIZE = 25;
const EXPIRY_THROTTLE_MS = 5 * 60 * 1000;

export function reservationWindowHours(): number {
  const raw = Number(process.env.ORDER_RESERVATION_WINDOW_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : ORDER_RESERVATION_WINDOW_HOURS;
}

// ISO-8601 cutoff. New orders store createdAt as an ISO string; older rows use
// SQLite's `YYYY-MM-DD HH:MM:SS`, which still compares chronologically because
// both begin with the UTC date and older rows sort before newer ones.
export function expiryCutoff(now: number = Date.now()): string {
  return new Date(now - reservationWindowHours() * 3_600_000).toISOString();
}

const EXPIRABLE_LIST = EXPIRABLE_STATUSES.map((status) => `'${status}'`).join(",");

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
