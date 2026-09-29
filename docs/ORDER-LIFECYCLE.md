# Larkvine order lifecycle and abandoned-inventory audit

Status: design **approved and implemented locally** on 2026-09-29. The owner approved automatic expiry (12 h from `createdAt`), WhatsApp handoff tracking, explicit vendor acceptance, customer cancellation before acceptance, bounded vendor rejection reasons, retained vendor-reported payment status, visible terminal `expired` orders, and per-child-order expiry. The additive migration `0019` was applied **only to local D1**; it has **not** been applied to production and nothing was deployed. Larkvine does not process payments; payment and delivery are arranged directly between the customer and the vendor over WhatsApp. See "Implementation (approved)" at the end of this document for what shipped.

Source of truth for statuses: `src/lib/orders.ts`, `src/app/api/orders/route.ts`, `src/app/admin/(store)/orders/actions.ts`, `prisma/schema.prisma`, migrations `0004`, `0012`, `0015`, `0016`, `0017`.

## 1. Current order state machine

Order creation is the API `POST /api/orders` (`src/app/api/orders/route.ts`). It inserts one `Checkout`, one child `Order` per store and its `OrderItem`s in a single D1 batch. The initial status is `sent_to_whatsapp` (`ORDER_STATUS_SENT_TO_WHATSAPP`). The Prisma default `pending` is not used by checkout.

Vendor/status changes go through the `updateOrder` server action (`src/app/admin/(store)/orders/actions.ts`): it pre-checks `canTransitionOrderStatus`, then issues a store-scoped compare-and-set:

```sql
UPDATE "Order" SET "status"=?, "paymentStatus"=?, "updatedAt"=CURRENT_TIMESTAMP
WHERE "id"=? AND "storeId"=? AND "status"=? RETURNING "id"
```

### Transition table

| From | To | Actor allowed | App guard | DB guard | Inventory effect | Idempotency |
| --- | --- | --- | --- | --- | --- | --- |
| — | `sent_to_whatsapp` | customer (checkout API) | token + price/stock/eligibility recheck | `0004` decrement trigger; `0016` tenancy; `0017` eligibility | **−qty** per item (once) | token hash + request hash in `Checkout` |
| `sent_to_whatsapp` | `pending` | vendor/admin (own store) | `canTransitionOrderStatus` | compare-and-set on status | none | no-op if status changed |
| `sent_to_whatsapp` | `confirmed` (accept) | vendor/admin | `canTransitionOrderStatus` | compare-and-set | none | no-op if status changed |
| `sent_to_whatsapp` | `cancelled` | vendor/admin | `canTransitionOrderStatus` | `0012` restores; `0015` not from shipped/delivered | **+qty once** | `AFTER UPDATE ... WHEN OLD<>cancelled` |
| `pending` | `confirmed` | vendor/admin | `canTransitionOrderStatus` | compare-and-set | none | as above |
| `pending` | `cancelled` | vendor/admin | `canTransitionOrderStatus` | `0012` | **+qty once** | as above |
| `confirmed` | `shipped` | vendor/admin | `canTransitionOrderStatus` | compare-and-set | none | as above |
| `confirmed` | `cancelled` | vendor/admin | `canTransitionOrderStatus` | `0012` | **+qty once** | as above |
| `shipped` | `delivered` | vendor/admin | `canTransitionOrderStatus` | compare-and-set | none | as above |
| `shipped`/`delivered` | `cancelled` | — | `canTransitionOrderStatus` false | `0015` ABORT | none | — |
| `delivered` | anything | — | false | `0015` terminal ABORT | none | — |
| `cancelled` | anything | — | false | `0012` reopen ABORT | none | — |
| any | same status | vendor/admin | allowed (no-op) | `status=?` may match | none | no-op |

**Terminology:** there is no explicit `accepted` status; the vendor's `confirmed` currently means "I acknowledge and intend to fulfil". There is no `expired` status, no `acceptedAt`, no `vendorContactOpenedAt`, no `rejectionReason`, and no customer-initiated cancellation.

## 2. Current inventory reservation behaviour

- Stock is decremented **at order creation**, inside the same D1 batch that creates the `Order`/`OrderItem`, by the `0004` `OrderItem_inventory_guard` BEFORE INSERT trigger (`stock = stock - NEW.quantity`, aborting on insufficient stock).
- The `0016` tenancy guard and `0017` eligibility guard re-check store match and approval/publication inside the same transaction, so a raced suspension/unpublish aborts the whole batch with no stock change.
- Stock is restored **exactly once** on first transition to `cancelled` by the `0012` `Order_cancel_restore_stock` AFTER UPDATE trigger (guarded by `OLD.status <> 'cancelled'`); `0012` also blocks reopening a cancelled order.
- `0015` blocks cancelling `shipped`/`delivered` orders (no automatic restock for dispatched goods).
- There is **no expiry and no other stock-release path**. Reservation is permanent until a vendor manually sets `cancelled`.

## 3. Abandoned-order failure mode

Because inventory is reserved at creation and the only release is a vendor cancellation, an order that the customer never completes off-platform holds stock indefinitely.

Facts from the code/DB:
- `createdAt` (schema default `now()`, set explicitly by the API) marks creation; `updatedAt` changes on any status edit.
- There is no vendor acceptance distinct from `confirmed`, no tracking of whether the customer opened the vendor WhatsApp, and no expiry timestamp/status.
- The `0012` restoration trigger is directly reusable for an `expired` transition (same at-most-once shape).

The size of the problem **cannot be quantified from current data** because there is no handoff tracking: production currently has 10 orders and 0 cancelled, but nothing records whether a `sent_to_whatsapp` order was ever acted on. Adding a handoff timestamp (section 11) is a prerequisite to measuring abandonment.

## 4. Policy options

| Option | Overselling risk | Customer UX | Vendor UX | Operational complexity | Concurrency | WhatsApp limitation |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Reserve until explicit cancel** (current) | Low for the buyer; high dead-stock / false "sold out" | Order stays "live" forever; no signal | Must manually clear stale orders | Lowest to build; highest manual toil | None new | Vendor may never cancel; stock silently stuck |
| **B. Auto-expire unconfirmed after a fixed period** | Low; stock returns automatically | Clear message: reservation expired, reorder if in stock | Must accept before the deadline | Medium (needs a sweep + guards) | Needs atomic compare-and-set + at-most-once restore | Customer must see the deadline and act on WhatsApp promptly |
| **C. Do not reserve until the vendor confirms** | **High** — oversell between order and confirmation; a confirmed order may find no stock | "Order requested", then possible rejection | Confirm = reserve; must reject if stock gone | Medium-high (second reservation step, new failure modes) | Confirm must re-check and reserve atomically | Vendor may confirm late after stock sold |
| **D. Short reservation window + accept-or-release** (B with a deliberate, shorter window and explicit accept) | Low | Time-boxed hold with a clear countdown; reorder after expiry | Clear deadline creates urgency; one Accept button | Medium (same as B, tuned) | Same as B | Best fit for WhatsApp: the customer is routed immediately and must contact the vendor within the window |

Option C is the riskiest because it inverts the reservation and can oversell. Options B/D are the same mechanism with a different window length; **the window length is a business decision**.

## 5. Recommended technical model (conditional — owner must choose the policy)

If automatic expiry is approved, use **Option D**:

```
created (sent_to_whatsapp)  ── vendor Accept ──► confirmed (accepted)
      │  stock reserved once (0004)
      │  deadline = createdAt + WINDOW
      ▼
   (unconfirmed past deadline)  ──► expired   (+stock restored exactly once)
```

Invariants:
1. Reservation happens once, at creation (unchanged).
2. Only `sent_to_whatsapp`/`pending` can expire. `confirmed`+ is never auto-expired.
3. An order confirmed before expiry can no longer expire (the vendor's compare-and-set wins the row; the sweep's `WHERE status IN (...)` then matches nothing).
4. Expiry restores stock exactly once (mirror `0012`: `AFTER UPDATE ... WHEN OLD<>'expired'`), and reopening an expired order is blocked (mirror `0012`/`0015`).
5. The sweep is idempotent: repeated runs are no-ops because the row no longer matches the eligible status.
6. Per child Order, never per parent Checkout.

Proposed trigger SQL (draft only — **not applied**):

```sql
-- DRAFT 0019_order_expiry_guard.sql (not in prisma/migrations; requires owner approval)
CREATE TRIGGER "Order_expire_restore_stock"
AFTER UPDATE OF "status" ON "Order"
WHEN NEW."status" = 'expired' AND OLD."status" <> 'expired'
BEGIN
  UPDATE "Product"
  SET "stock" = "stock" + (
    SELECT COALESCE(SUM("quantity"),0) FROM "OrderItem"
    WHERE "orderId" = NEW."id" AND "productId" = "Product"."id"
  ), "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" IN (SELECT "productId" FROM "OrderItem" WHERE "orderId" = NEW."id")
    AND "storeId" = NEW."storeId";
END;

CREATE TRIGGER "Order_expire_scope_guard"
BEFORE UPDATE OF "status" ON "Order"
WHEN NEW."status" = 'expired' AND OLD."status" <> 'expired'
  AND OLD."status" NOT IN ('sent_to_whatsapp','pending')
BEGIN
  SELECT RAISE(ABORT, 'Only an unconfirmed order can expire');
END;

CREATE TRIGGER "Order_expired_reopen_guard"
BEFORE UPDATE OF "status" ON "Order"
WHEN OLD."status" = 'expired' AND NEW."status" <> 'expired'
BEGIN
  SELECT RAISE(ABORT, 'Expired order cannot be reopened');
END;

CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
```

Sweep (conceptual), one statement per candidate, each atomic:

```sql
UPDATE "Order" SET "status"='expired', "updatedAt"=CURRENT_TIMESTAMP
WHERE "status" IN ('sent_to_whatsapp','pending')
  AND "createdAt" < ?              -- now - WINDOW
  AND "id" = ?
RETURNING "id";
```

## 6. Owner decisions still required

Policy decisions (cannot be made by engineering):
1. **Adopt automatic expiry (options B/D) or keep A?**
2. **Reservation window** (e.g. 24 h / 48 h / 72 h) if B/D.
3. **Should the window start at order creation or at first WhatsApp handoff?** (The latter requires section 11.)
4. **Customer cancellation:** may the customer cancel before vendor acceptance? After acceptance? While processing? After completion?
5. **Vendor rejection reasons:** required or optional? which set?
6. **Keep vendor-reported payment status** (`paymentStatus`), or remove it?
7. **Explicit vendor "Accept"** as distinct from the current `confirmed`?
8. **Should an expired order be visible in customer history** (for transparency) or hidden?
9. **Multi-vendor:** confirm per-child-order expiry (recommended) with no parent-level effect.

## 7. Vendor acceptance design

Add an explicit **Accept** action (today `confirmed` is the closest equivalent). Recommended lifecycle without renaming history: `sent_to_whatsapp` → `confirmed` (Accept) → `shipped` → `delivered`, plus `cancelled`/`expired`. The Accept button should be a one-tap store-scoped compare-and-set (existing `updateOrder` pattern). Accept means "I acknowledge and intend to fulfil" — **never** "payment verified". Optionally add `acceptedAt` (additive) for auditing and for the expiry interaction.

## 8. Customer cancellation design

No customer cancellation exists today. If approved: a session-owned, atomic, idempotent cancel that only permits the customer's own order and only in eligible states (likely `sent_to_whatsapp`/`pending`, maybe `confirmed`), reusing the `0012` restoration guarantee and the same compare-and-set pattern. Cancellation must never be possible from `shipped`/`delivered`. Policy (which states are cancellable) is an owner decision (section 6.4).

## 9. Vendor rejection design

Vendors can currently only reach `cancelled` (no reason). If a rejection reason is wanted, add nullable `rejectionReason` (additive) with a bounded enum (`out_of_stock`, `unable_to_deliver`, `customer_unreachable`, `customer_requested`, `duplicate`, `other`) surfaced to the vendor only where appropriate; the customer-facing history should show a neutral status and, if policy allows, a safe reason. Internal notes must never be exposed.

## 10. Payment reporting design

`paymentStatus` is vendor-set (`pending`|`paid`) and is already labelled "Vendor-reported payment" / "Vendor marked payment received" in vendor and customer UI. It is **not** verified by Larkvine. Recommendation: keep it (useful to the vendor) but do not let it imply platform verification; no new payment concepts. If the owner finds it low-value, it can be removed without affecting inventory. Either way, no gateway/wallet/ledger is introduced.

## 11. WhatsApp handoff tracking

Proposed additive column `vendorContactOpenedAt DateTime?` set by a server action when the customer clicks "Continue with <Store> on WhatsApp". Requirements: set server-side (not trusting client), first click wins (idempotent), per child Order, no payment implication, no new order on repeat clicks. This distinguishes "created but never contacted" from "customer opened WhatsApp" and is the prerequisite for measuring abandonment and for a handoff-based expiry window. **Not implemented** pending owner approval (section 6.3).

## 12. Expiry mechanism (Cloudflare-compatible)

Two viable options; the choice is an architecture decision, not a business one:

- **Request-driven opportunistic sweep (recommended for this stack):** a small bounded `UPDATE` over `status IN ('sent_to_whatsapp','pending') AND createdAt < cutoff` executed server-side (e.g. from a low-traffic server route/action, bounded to N rows per run). No cron wiring, works with the single OpenNext fetch worker, idempotent, and naturally rate-limited by traffic. Risk: on a very quiet site the sweep can lag, which is acceptable for a soft reservation window.
- **Cloudflare Cron Trigger + `scheduled` handler:** deterministic, but OpenNext serves a single `fetch` worker; adding a `scheduled` handler requires an approved custom worker entry and a `[triggers] crons` binding. More moving parts and must be verified against the known-good runtime.

Either mechanism must: select only eligible rows, transition atomically per child Order, restore stock once, tolerate repeat runs, log/count, and never touch `confirmed`/`shipped`/`delivered`/`cancelled`/`expired`.

## 13. Multi-vendor behaviour

Expiry and cancellation operate **per child Order**. In a Checkout with Vendor A (confirmed) and Vendor B (abandoned), only Vendor B's order expires and only Vendor B's inventory is restored; the parent `Checkout` is untouched. This is already the natural granularity because stock lives on `OrderItem` per `storeId` and the restoration trigger is scoped by `NEW.storeId`.

## 14. Inventory concurrency guarantees

- Creation decrement and cancellation/expiry restore are trigger-scoped and transactional with the status write.
- The proposed expiry mirrors `0012`'s at-most-once pattern and adds a status-scope guard so `confirmed`+ cannot expire.
- Expiry vs Accept is a compare-and-set race on the same `status` column: exactly one wins; if Accept wins, expiry matches nothing; if expiry wins, the vendor's update returns no row and the UI asks the vendor to refresh.
- Repeated sweeps and repeated cancellations are no-ops.

## 15. Schema changes required (proposed, none applied)

| Change | Type | Purpose |
| --- | --- | --- |
| `expired` status value | app constant + docs (status is a free string) | terminal abandoned state |
| `Order.vendorContactOpenedAt DateTime?` | additive nullable | handoff traceability / measurement |
| `Order.acceptedAt DateTime?` | additive nullable (optional) | acceptance audit + expiry interaction |
| `Order.rejectionReason String?` | additive nullable (optional) | vendor rejection reason |
| `Index("Order"("status","createdAt"))` | additive index | bounded expiry queries |

No historical row is rewritten; all changes are additive and back-compatible.

## 16. Migration plan

1. Owner approves policy and the schema changes.
2. Produce a reviewed additive migration (draft above) plus the Prisma model update.
3. Rehearse it against an **authorized production-like export** using `scripts/rehearse-production-import.mjs` (currently `BLOCKED — AUTHORIZED EXPORT REQUIRED`); confirm counts, statuses and inventory are unchanged before/after.
4. Release the migration together with the matching code, in a controlled window, per `docs/FOUNDATION-DEPLOYMENT.md`.
5. **Not applied in this batch.**

## 17. Tests required / added

Design-validation tests are added in `tests/order-expiry-design.test.mjs` (self-contained in-memory SQLite, no production migration) to prove the proposed model before approval: expiry vs accept race, expiry vs cancel race, repeated sweep, repeated cancel, two concurrent vendor actions, exactly-once restore, confirmed/completed cannot expire, one child's expiry does not affect another vendor, and reopen requires fresh stock. Existing `tests/order-cancellation.test.mjs`, `order-status.test.mjs`, `order-tenancy.test.mjs` already cover the current guarantees.

The design tests surfaced two required guard refinements, now reflected in section 5: (a) the expiry scope guard must exempt `OLD.status = 'expired'` so a repeated sweep on an already-expired row is an idempotent no-op rather than an abort; and (b) customer cancellation must be status-eligible (`WHERE status IN ('sent_to_whatsapp','pending')`) so that once an order expires, a racing cancellation matches nothing and cannot attempt to reopen it.

## 18. Production compatibility

All proposed changes are additive (nullable columns, a new index, a new status string, new triggers). Existing statuses (`sent_to_whatsapp`, `pending`, `confirmed`, `shipped`, `delivered`, `cancelled`) and historical rows are untouched. The current production DB has 10 orders / 0 cancelled and no `expired` rows, so no backfill is needed. Migration is nevertheless gated on the authorized production export/rehearsal.

## 19. Security findings

- Status changes are store-scoped compare-and-set server actions; a vendor cannot touch another store's order (verified previously).
- No customer mutation endpoint exists; any customer cancellation must be session-owned and re-check ownership and eligibility server-side.
- The expiry sweep is server-only (no client input for cutoff or row selection) and must be bounded to avoid abuse.
- Stock can only be changed through DB triggers on order creation/cancel/expiry; client input never sets stock directly.
- Client cannot forge vendor assignment, price, or the WhatsApp recipient (verified elsewhere).

## 20. Customer UX changes (recommended, not implemented)

Order history wording today: `sent_to_whatsapp` → "Sent to WhatsApp", plus "Order created · Payment and delivery arranged with the seller". Recommended additions if expiry is adopted: make each child order's state explicit — *Order placed → Contact seller → Seller accepted → Processing → Completed / Cancelled / Expired* — and, on expiry, "This reservation expired; you can place a new order if the item is still available." Avoid any wording implying Larkvine processed or verified payment.

## 21. Vendor UX changes (recommended, not implemented)

Show a pending count/badge and order age, surface "Accept" and "Reject/Cancel" prominently, show the customer's contact and the handoff timestamp once tracked, and show a lightweight status history. No financial dashboards.

## 22–27. Verification (this batch)

| Check | Result |
| --- | --- |
| `npm test` | see final report |
| `tsc --noEmit` | see final report |
| `lint` | see final report |
| `build` | see final report |
| `verify:deps` | see final report |
| `verify:worker-runtime` | see final report |
| `git diff --check` | see final report |
| `npm audit` | see final report |

## 28. Files changed

`docs/ORDER-LIFECYCLE.md` (new), `tests/order-expiry-design.test.mjs` (new), `AUDIT.md` (update). No application, schema or migration files changed.

## 29. Production status

Unchanged: `a5cc3fb0-0c4e-4fd1-b12e-97130024fa1e`, migrations `0012`–`0018`, healthy. No deploy in this batch.

## 30. Owner decisions needed before implementation

See section 6. In order of dependency: (1) expiry or not; (2) window and start point; (3) handoff tracking yes/no; (4) customer cancellation scope; (5) vendor rejection reasons; (6) keep vendor payment reporting; (7) explicit Accept; (8) expired-order visibility. Until these are answered, **no lifecycle code or migration will be produced**.

## Implementation (approved decisions) — 2026-09-29

Owner decisions locked: **12 h reservation window from `createdAt`** (central config `ORDER_RESERVATION_WINDOW_HOURS` in `src/lib/order-expiry.ts`, env-overridable); **`vendorContactOpenedAt`** first-click-only, server-recorded, never extends expiry and never implies payment; **explicit vendor Accept** (`acceptOrder` → `confirmed` + `acceptedAt`); **customer cancellation only before acceptance** (`sent_to_whatsapp`/`pending`, owner-scoped, atomic, idempotent); **bounded vendor rejection reasons**; **vendor-reported payment retained** (no inventory effect); **`expired` terminal and visible**; **per-child-order expiry**.

Implemented:
- `prisma/migrations/0019_order_expiry_lifecycle.sql` — nullable `vendorContactOpenedAt`, `acceptedAt`, `rejectionReason`; `Index("Order"("status","createdAt"))`; `Order_expire_restore_stock`, `Order_expire_scope_guard` (exempts `OLD='expired'` for idempotency), `Order_expired_reopen_guard`. Additive; applied to local D1 only.
- `src/lib/orders.ts` — `expired` status, buyer-facing labels, `EXPIRABLE/ACCEPTABLE/CUSTOMER_CANCELLABLE/VENDOR_CANCELLABLE` predicates, bounded `REJECTION_REASONS` with safe customer text.
- `src/lib/order-expiry.ts` — `ORDER_RESERVATION_WINDOW_HOURS = 12`, `expiryCutoff`, bounded + throttled `sweepExpiredOrders` (per-order compare-and-set) and non-throwing `runOpportunisticExpirySweep`. Sweep touch points: `POST /api/orders` (via `ctx.waitUntil`), `/account/orders`, and the vendor `/admin/orders` page.
- `POST /api/orders/[id]/contact-opened` — owner-session or checkout-bearer authorized; sets `vendorContactOpenedAt` only if `NULL`; never changes status; `src/components/order/WhatsAppHandoff.tsx` records on click (keepalive) and then opens the server-rendered wa.me URL.
- `acceptOrder` / `rejectOrder` vendor server actions (store-scoped compare-and-set; rejection requires a bounded reason); customer `cancelOwnOrder` server action + `CancelOrderButton` (owner-scoped, eligible states only). Guest cancellation is intentionally unsupported — guest security was not weakened.
- Vendor `/admin/orders`: order age, status, WhatsApp-handoff timestamp, accepted time, rejection reason, prominent **Accept order** and **Reject / Cancel** (reason select); `cancelled`/`expired` are read-only; payment select retained and labelled vendor-reported. Customer `/account/orders`: buyer labels, per-order **Cancel order** before acceptance, expiry explanation + **Order again**, WhatsApp handoff tracking.

Migration rehearsal: **BLOCKED — AUTHORIZED EXPORT REQUIRED.** `0019` is additive (nullable columns, one index, triggers) and local production-like rehearsal on synthetic data is covered by `tests/order-lifecycle.test.mjs`, but no authorized production export is available, so production compatibility of the historical 10 orders is unverified. Do not apply to production until the rehearsal gate clears.
