# Larkvine money, payment, and vendor-ledger design

Status: design and repository audit, 2026-09-29. No payment provider, payout system, or production migration has been deployed.

## Current money flow and evidence

Larkvine displays `₦` in `formatPrice()` (`src/lib/utils.ts`) and the product form labels prices in naira (`src/components/admin/ProductForm.tsx`). The form accepts hundredths with `step="0.01"`. Seed prices are whole naira, but the schema does not enforce whole naira or a currency on Product/Order. The new Checkout identity records `NGN`; historical orders have `country="NG"` but no currency field. The application presently assumes NGN. This assumption needs a production data audit before a monetary migration.

1. Vendor product form previously used `Number()`; it now parses at most two decimal places and dual-writes integer kobo (`src/app/admin/(store)/products/actions.ts`). Historical `Product.price`/`compareAt` remain `Float`/SQLite `REAL`.
2. Product pages and browser cart copy that price into a Zustand/localStorage cart (`src/components/product/ProductDetails.tsx`, `src/store/cart.ts`). Cart subtotal is floating-point `sum + price * quantity`. This is display-only and user-controlled.
3. Checkout reloads products by ID and uses database prices (`src/app/api/orders/route.ts`). New checkout calculations use integer kobo per store and dual-write Order/OrderItem minor-unit snapshots and legacy `REAL`, shipping `0`, no applied discount or tax. The browser's submitted price/store ID is ignored. A single Checkout groups separate vendor Orders.
4. New receipts sum vendor Order minor-unit totals (`src/app/order-confirmation/[id]/page.tsx`); legacy orders fall back to validated `REAL`. Vendor dashboard now labels only vendor-reported `paymentStatus="paid"` amounts as such (`src/app/admin/(store)/dashboard/page.tsx`). Vendors can manually set this status, and Larkvine has no proof of funds.
5. DiscountCode `value` and `minOrder` are `Float`. Discount codes are managed in the vendor UI but are not applied by the checked-in checkout route. No commission, refund, payout fee, or payout calculation is implemented.

**Risk:** historical binary floating-point values can change decimal results under multiplication, addition, and percentage calculations. The larger current risk is semantic: manual WhatsApp payment and vendor-edited status cannot support verified revenue, balance, commission, refund, or payout figures. Cart and checkout now describe shipping as arranged with the store; checkout still records zero shipping.

## Canonical monetary representation

Use integer minor units with an explicit ISO currency, initially `NGN` and kobo. `₦1,250.50` is `125050` kobo. Validate at the boundary with decimal-string parsing; avoid `Number(formData)` for new prices. Arithmetic uses safe integers (or `bigint` if validated platform limits require amounts beyond JavaScript's safe-integer range). Persist monetary snapshots per OrderItem and Order, not only the current Product price. Each vendor Order carries its own merchandise, shipping, discount, tax, fee, and total amounts. A Checkout total is the sum of its vendor Orders and is immutable once a payment intent is initialized. A currency mismatch must be rejected before payment initiation.

**Migration strategy:**

1. Read-only production audit: count non-NGN assumptions, prices with more than two decimal places, negative or non-finite values, large values beyond safe integer limits, and historical Order subtotals that differ from item snapshots. Capture a backup and reconciliation totals.
2. Add nullable integer-kobo columns alongside legacy `REAL` columns. Deploy dual writes for new products/orders. Do not reinterpret old `REAL` values in place or round historical amounts silently.
3. Backfill only rows whose conversion is exact to two decimals under a documented tolerance. Put ambiguous rows into a review report. Reconcile row counts and per-order totals before switching reads.
4. Switch financial reads to integer columns after backfill coverage and reconciliation pass. Retain old columns for rollback through a release window. Remove them only in a later audited migration.

Because production data has not been inspected, no historical-money backfill or destructive conversion is authorized by this audit. New checkout arithmetic can be moved to validated integer kobo ahead of the historical migration while continuing to write existing `REAL` columns for compatibility; the old columns remain noncanonical until backfill.

## Payment architecture proposal

The current WhatsApp handoff is a manual, unverified method. It must remain clearly identified as such until a provider is selected and a full payment flow is built.

Proposed entities:

- `PaymentIntent`: one per Checkout attempt, with amountMinor, currency, method/provider, status (`pending`, `succeeded`, `failed`, `expired`, `refunded`, `partially_refunded`), provider reference, expiration, and immutable pricing snapshot.
- `PaymentEvent`: immutable inbound webhook/reconciliation record with provider event ID (unique per provider), signature-verification result, received time, sanitized payload reference/hash, outcome, and processing state.
- `Refund`: amountMinor, currency, provider reference, Checkout/Order allocations, reason, state, and idempotency key.

Provider-neutral operations: `initialize(intent)`, `verify(reference)`, `refund(payment, amountMinor, idempotencyKey)`, `parseAndVerifyWebhook(rawBody, headers)`. Provider adapters must not alter Order status directly. A single payment service validates provider amount/currency/reference, persists the event idempotently, and transitions the PaymentIntent with a guarded update. The browser redirect only triggers a server verification request or displays pending status; it never marks an order paid. Webhooks and periodic reconciliation handle delayed/missed events. Duplicate events become no-ops. Mismatched amount/currency is an exception requiring review, not a paid transition. Refunds create new auditable records and ledger reversals. Expiration and provider outage retain the order/payment in explicit pending or failed states; they do not fabricate success.

Manual WhatsApp payments need a separate `manual_unverified` or `vendor_reported_paid` state. Vendor edits cannot set provider-verified `paid`. Platform finance staff may record verified offline settlements with evidence and an audit log, if that business process is approved.

## Vendor financial ledger proposal

No withdrawable balance should be inferred from Order totals. Use append-only entries with idempotent source keys, store ID, Checkout/Order ID, currency, signed integer minor amount, type, availability time, and actor/source reference. Types: `SALE`, `COMMISSION`, `PAYMENT_FEE`, `SHIPPING_ALLOCATION`, `REFUND`, `ADJUSTMENT`, `PAYOUT`, `PAYOUT_REVERSAL`. Do not update or delete posted entries; reverse with compensating entries. A unique `(sourceType, sourceId, entryType, storeId)` or equivalent allocation ID guards duplicate webhook processing. A payout request reserves available funds, then moves through `requested → processing → paid/failed`; a failed payout releases the reservation exactly once. Reconcile provider settlement, platform clearing, vendor liabilities, and ledger totals daily. Pending balance includes sales awaiting settlement/return windows; available balance includes only eligible settled entries less reserved payouts and reversals. Every displayed balance must be reproducible from entries and snapshot checkpoints.

The exact commission rate, ownership of shipping, refund liability, settlement delay, payout cadence/threshold, and provider are business decisions not present in code. They must be fixed before financial operations are implemented.

## Deployment boundary

No payment or payout code should deploy from this design alone. The additive integer-money schema is implemented for new writes but has not been deployed or backfilled in production. Before a payment rollout: select provider and financial policy; validate historical data; implement provider sandbox and webhook tests; reconcile synthetic multi-vendor payments, partial refunds, duplicate webhooks, and payouts; then approve a staged production deployment. Migrations `0012` through `0017` and matching application code form one controlled foundation release; see `docs/FOUNDATION-DEPLOYMENT.md`.
