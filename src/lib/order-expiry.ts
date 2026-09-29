// Automatic expiry of unaccepted orders, so inventory is not held indefinitely.
//
// Each order persists `reservationExpiresAt` at creation (createdAt + window);
// the window config lives in `src/lib/reservation.ts` (single source). Every
// mutation path — sweep, targeted checkout cleanup, Accept, customer Cancel,
// vendor Reject — uses the persisted deadline, so a delayed sweep can never
// extend a reservation and a config change only affects new orders.
//
// Two entry points:
//   - sweepExpiredOrders: bounded general housekeeping.
//   - expireStaleReservationsForProducts: TARGETED, product-scoped cleanup that
//     runs before authoritative stock validation in checkout, so a stale
//     reservation cannot block a new buyer while stock is locked.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { EXPIRABLE_STATUSES } from "@/lib/orders";
import { ORDER_RESERVATION_WINDOW_HOURS, reservationExpiresAtIso, reservationWindowHours } from "@/lib/reservation";

export { ORDER_RESERVATION_WINDOW_HOURS, reservationWindowHours, reservationExpiresAtIso };

// Small batch + throttle so opportunistic sweeps are cheap when nothing is stale.
export const EXPIRY_BATCH_SIZE = 25;
const TARGETED_LIMIT = 50;
const EXPIRY_THROTTLE_MS = 5 * 60 * 1000;

const EXPIRABLE_LIST = EXPIRABLE_STATUSES.map((status) => `'${status}'`).join(",");
const nowIso = (nowMs: number) => new Date(nowMs).toISOString();

// Atomically expire ONE specific order whose persisted deadline has passed. The
// guarded compare-and-set is the only writer; the 0019 trigger restores stock
// exactly once on first entry into 'expired'. NULL deadlines are grandfathered
// and never expire. Optional scope limits which order the caller may expire.
export async function expireOrderIfStale(
  env: CloudflareEnv,
  id: string,
  scope?: { storeId?: string; userId?: string; now?: number },
): Promise<boolean> {
  const clauses = [`"id" = ?`];
  const bind: unknown[] = [id];
  if (scope?.storeId) { clauses.push(`"storeId" = ?`); bind.push(scope.storeId); }
  if (scope?.userId) { clauses.push(`"userId" = ?`); bind.push(scope.userId); }
  bind.push(nowIso(scope?.now ?? Date.now()));
  const updated = await env.DB
    .prepare(`UPDATE "Order" SET "status" = 'expired', "updatedAt" = CURRENT_TIMESTAMP WHERE ${clauses.join(" AND ")} AND "status" IN (${EXPIRABLE_LIST}) AND "reservationExpiresAt" IS NOT NULL AND "reservationExpiresAt" <= ? RETURNING "id"`)
    .bind(...bind)
    .first<{ id: string }>();
  return Boolean(updated);
}

// Targeted cleanup: expire stale, unaccepted child orders that reserve any of the
// given products, BEFORE stock is validated for a new checkout. Bounded and
// product-indexed. Returns the number of orders expired. Never throws.
export async function expireStaleReservationsForProducts(
  env: CloudflareEnv,
  productIds: string[],
  options?: { now?: number; limit?: number },
): Promise<number> {
  const unique = [...new Set(productIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (!unique.length) return 0;
  const now = options?.now ?? Date.now();
  const limit = Math.max(1, Math.min(options?.limit ?? TARGETED_LIMIT, 200));
  const placeholders = unique.map(() => "?").join(",");

  const stale = await env.DB
    .prepare(
      `SELECT DISTINCT o."id" AS id FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId" WHERE i."productId" IN (${placeholders}) AND o."status" IN (${EXPIRABLE_LIST}) AND o."reservationExpiresAt" IS NOT NULL AND o."reservationExpiresAt" <= ? LIMIT ?`,
    )
    .bind(...unique, nowIso(now), limit)
    .all<{ id: string }>();

  let expired = 0;
  for (const row of stale.results ?? []) {
    if (await expireOrderIfStale(env, row.id, { now })) expired += 1;
  }
  return expired;
}

let lastSweepAt = 0;

// Expire at most `limit` stale, unaccepted orders (general housekeeping). Each
// order transitions with its own compare-and-set. Idempotent.
export async function sweepExpiredOrders(options?: { env?: CloudflareEnv; limit?: number; force?: boolean; now?: number }): Promise<number> {
  const now = options?.now ?? Date.now();
  if (!options?.force && now - lastSweepAt < EXPIRY_THROTTLE_MS) return 0;
  lastSweepAt = now;

  const db = options?.env?.DB ?? (await getCloudflareContext({ async: true })).env.DB;
  const limit = Math.max(1, Math.min(options?.limit ?? EXPIRY_BATCH_SIZE, 100));

  const stale = await db
    .prepare(`SELECT "id" FROM "Order" WHERE "status" IN (${EXPIRABLE_LIST}) AND "reservationExpiresAt" IS NOT NULL AND "reservationExpiresAt" <= ? ORDER BY "reservationExpiresAt" ASC LIMIT ?`)
    .bind(nowIso(now), limit)
    .all<{ id: string }>();

  let expired = 0;
  for (const row of stale.results ?? []) {
    const updated = await db
      .prepare(`UPDATE "Order" SET "status" = 'expired', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND "status" IN (${EXPIRABLE_LIST}) AND "reservationExpiresAt" IS NOT NULL AND "reservationExpiresAt" <= ? RETURNING "id"`)
      .bind(row.id, nowIso(now))
      .first<{ id: string }>();
    if (updated) expired += 1;
  }
  return expired;
}

// Best-effort opportunistic sweep for request handlers/pages. Never throws.
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
