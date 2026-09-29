# Marketplace financial decisions required before payments

Status: owner decision document, 2026-09-29. **No payment gateway, payout, commission or ledger code is to be implemented from this document.** It records decisions the owner must make, their technical consequences, and where the system stands today. Complementary design background is in `docs/MONEY-AND-PAYMENTS.md`.

## Current state (facts)

- Payment is arranged manually over WhatsApp. There is **no provider, no ledger, no commission, no payout, no refund model**.
- `Order.paymentStatus` is a vendor-set `pending|paid` string. It is a **vendor report**, not verified funds.
- New checkout writes integer kobo snapshots (`subtotalMinor`, `totalMinor`, `OrderItem.priceMinor`) and `currency="NGN"`; historical `REAL` columns remain for compatible reads and are not backfilled.
- A `Checkout` groups one customer purchase into per-store child `Order`s. There is no parent payment record.

## Decisions required

For each decision: **Decision — Options — Technical consequence — Current status (all OPEN).**

| # | Decision | Options | Technical consequence |
| --- | --- | --- | --- |
| 1 | Payment provider | Paystack, Flutterwave, Stripe, none (stay manual) | Determines the `PaymentIntent`/webhook adapter, supported currencies and payout rails. NGN-first suggests a Nigerian provider. |
| 2 | Payment methods | Card, bank transfer, USSD, wallets, cash/manual | Which provider capabilities and reconciliation events exist; manual cash needs an explicit unverified state. |
| 3 | Platform commission | none, flat %, per-category %, tiered | Commission entries in the vendor ledger and split logic at payment capture; changes every order total and receipt. |
| 4 | Delivery-fee ownership | customer→platform, customer→vendor, platform-absorbed | Whether shipping is a platform revenue line or passes through; affects `shippingMinor` allocation and ledger types. |
| 5 | Refund liability | platform, vendor, shared | Whether refunds debit a platform clearing account or the vendor's payable balance; affects negative-balance handling. |
| 6 | Partial refunds | supported, all-or-nothing | Requires `Refund.amountMinor` ≤ captured and per-line allocation; all-or-nothing is simpler but rigid. |
| 7 | Payout hold period | 0, 3, 7, 14 days post-delivery/settlement | `AVAILABLE_AT` on sale ledger entries; a short hold needs return/chargeback handling. |
| 8 | Payout eligibility | settled sales only; deliveries confirmed; disputes clear | Definition of "available"; requires settlement and dispute state to exist first. |
| 9 | Payout minimum | ₦0, ₦5,000, ₦10,000, … | Balance threshold before a payout is allowed; small minimums increase transfer fees. |
| 10 | Payout fee | platform pays, vendor pays flat, vendor pays % | A `PAYOUT_FEE` ledger entry; affects the amount a vendor actually receives. |
| 11 | Failed payout behavior | auto-retry, hold for review, reverse reservation | A payout reservation must release exactly once on failure (`PAYOUT_REVERSAL`); provider-specific retry semantics. |
| 12 | Chargeback liability | platform, vendor, shared | Whether a chargeback creates a vendor negative balance and blocks payouts; needs a dispute record. |
| 13 | Manual adjustments | finance-only, admin-only, with evidence | An `ADJUSTMENT` ledger type with actor, reason and audit trail; who may post it. |
| 14 | Cancellation after payment | full refund + cancel, block cancellation, credit only | Ties order status transitions to refund creation; must keep the `0012` one-restoration inventory guarantee. |
| 15 | Multi-vendor refund allocation | per child Order, platform-level | Because one Checkout maps to several vendor Orders, a refund must allocate to specific child Orders and their ledger entries. |

No option is selected here. **Do not implement policy on the owner's behalf.**

## Verification-status vocabulary (required before any ledger work)

The database today cannot distinguish how a payment was confirmed. Before a ledger is added, introduce an explicit source rather than overloading `paymentStatus`:

`manual_unverified` → `vendor_reported_paid` → `admin_confirmed` (offline settlement with evidence) → `platform_verified` (provider webhook/reconciliation).

## Vendor ledger readiness review (Phase 90)

A previously proposed append-only ledger (`docs/MONEY-AND-PAYMENTS.md`) can support the required entry types: `SALE`, `COMMISSION`, `PAYMENT_FEE`, `SHIPPING_ALLOCATION`, `REFUND`, `ADJUSTMENT`, `PAYOUT`, `PAYOUT_REVERSAL`. Readiness checklist:

| Requirement | Supported by the proposal? | Notes |
| --- | --- | --- |
| Sale | yes | `SALE` positive entry per OrderItem/Order, idempotent source key. |
| Platform commission | yes | `COMMISSION` negative entry, one per sale after rate is fixed. |
| Payment fee | yes | `PAYMENT_FEE` from provider settlement. |
| Refund / partial refund | yes | `REFUND` with per-child-Order line allocation. |
| Adjustment | yes | `ADJUSTMENT` with actor + reason + audit log. |
| Payout / reversal | yes | Reserve → `PAYOUT`; failure releases once via `PAYOUT_REVERSAL`. |
| Derivable balance | yes, if balances are computed from entries + snapshot checkpoints | **Do not** store `vendor.balance` as a mutable total. |
| Idempotency | yes | Unique `(sourceType, sourceId, entryType, storeId)` (or allocation id). |

**Schema conflicts / gaps found in the current schema:**

- `Order.paymentStatus` conflates report and verification (see vocabulary above) and must not be treated as a ledger source.
- No `PaymentIntent`, `PaymentEvent`, `Refund`, `LedgerEntry`, `Payout` or `Dispute` models exist; all would be additive.
- `Order`/`OrderItem` already carry `currency`/minor-unit snapshots for new rows; historical `REAL` values need an audited backfill before an integer-only ledger can rely on them.
- `Checkout` has no total or payment status; a parent payment must reference the Checkout and then allocate to child Orders.
- No audit-log table exists; adjustments, manual settlements and payout approvals require one.

**Conclusion:** the proposed append-only ledger is compatible with the current schema as an additive migration, provided (a) balances are derived, (b) payment verification gets its own states, and (c) no financial code ships before the decisions above are made and historical money is audited.

## Phase 99 — Owner decision form (consolidated, all UNRESOLVED)

Status: **FINANCIAL IMPLEMENTATION BLOCKED — OWNER DECISIONS REQUIRED.** Every item below is unselected. "Neutral default architecture" is the technical design that is correct regardless of which policy is chosen; it is not a policy recommendation. Record the owner's answer in the "Answer" line before any financial code is written.

### 1. Payment provider
- **Why it matters:** selects the webhook adapter, supported currencies, refund API and payout rails.
- **Options:** Paystack · Flutterwave · Stripe · none for now.
- **Consequence:** adapter + credentials + webhook signature scheme + payout capability differ per provider; NGN-first favours a Nigerian provider.
- **Neutral default architecture:** provider-neutral `PaymentProvider` port; one concrete adapter behind it. **Answer:**

### 2. Supported payment methods
- **Why it matters:** determines which events reconcile and whether an unverified manual state is required.
- **Options:** card · bank transfer · USSD · wallets · manual/cash.
- **Consequence:** each method's settlement/fee/refund behaviour must be handled; manual needs an explicit unverified status.
- **Neutral default architecture:** store method on the payment record as data, never as separate status fields. **Answer:**

### 3. Marketplace commission model
- **Why it matters:** changes every order's split and the vendor ledger.
- **Options:** none · flat % · flat fee · % + flat · category-specific · vendor-specific.
- **Consequence:** whether a `COMMISSION` ledger entry exists and how it is computed.
- **Neutral default architecture:** a single commission engine with a pluggable rule; snapshot the applied rule id/rate on the order. **Answer:**

### 4. Commission percentage / rule value
- **Why it matters:** the actual number; cannot be inferred.
- **Options:** e.g. 0% · 5% · 10% · per category table.
- **Consequence:** exact vendor payable amount and receipt totals.
- **Neutral default architecture:** store rate as basis points in integer form on the snapshot. **Answer:**

### 5. Delivery-fee ownership
- **Why it matters:** decides whether shipping is platform revenue or passes to the vendor.
- **Options:** customer→platform · customer→vendor · platform-absorbed · split.
- **Consequence:** `shippingMinor` allocation and ledger entry types (`DELIVERY_CREDIT`/`DELIVERY_DEBIT`).
- **Neutral default architecture:** keep shipping a distinct, explicitly allocated amount; never silently fold into merchandise. **Answer:**

### 6. Who bears payment-processing fees
- **Why it matters:** affects vendor net and platform margin; provider charges a real fee.
- **Options:** platform · vendor · split by policy.
- **Consequence:** whether a `PAYMENT_FEE` ledger entry debits the vendor, the platform, or both.
- **Neutral default architecture:** record the provider fee as its own immutable entry with a bearer field, so policy can change without re-deriving history. **Answer:**

### 7. Refund liability
- **Why it matters:** decides whose balance a refund reduces.
- **Options:** platform · vendor · shared.
- **Consequence:** platform clearing-account debit vs vendor payable debit; negative-balance rules.
- **Neutral default architecture:** refunds are separate `Refund` records allocated to child Orders; liability is a field on the allocation. **Answer:**

### 8. Partial-refund policy
- **Why it matters:** whether item/amount-level refunds are allowed.
- **Options:** supported (item/amount) · all-or-nothing.
- **Consequence:** per-line allocation vs simple full reversal; partial needs `amountMinor ≤ captured`.
- **Neutral default architecture:** model `Refund.amountMinor` from the start even if policy is all-or-nothing, so partials can be enabled without a migration. **Answer:**

### 9. Vendor payout hold period
- **Why it matters:** when a sale becomes withdrawable.
- **Options:** 0 · 3 · 7 · 14 days after delivery/settlement.
- **Consequence:** `AVAILABLE_AT` timestamp on sale entries; short holds need dispute/return handling.
- **Neutral default architecture:** every sale entry carries an availability timestamp; balance queries filter on it. **Answer:**

### 10. Vendor payout eligibility
- **Why it matters:** defines "available".
- **Options:** settled sales only · delivery confirmed · disputes cleared · combination.
- **Consequence:** which state must exist before the hold clock and availability apply.
- **Neutral default architecture:** eligibility is a derived predicate over ledger entries + order/payout state, never a stored boolean on the vendor. **Answer:**

### 11. Minimum payout amount
- **Why it matters:** transfer cost vs vendor convenience.
- **Options:** ₦0 · ₦5,000 · ₦10,000 · other.
- **Consequence:** request validation threshold.
- **Neutral default architecture:** a single configured constant, not hard-coded per call site. **Answer:**

### 12. Payout fees
- **Why it matters:** whether the vendor receives the full requested amount.
- **Options:** platform pays · vendor flat · vendor %.
- **Consequence:** a `PAYOUT_FEE` entry reducing the vendor's net.
- **Neutral default architecture:** fee is a separate ledger entry, so net is derivable. **Answer:**

### 13. Failed-payout handling
- **Why it matters:** a failed transfer must release the reservation exactly once.
- **Options:** auto-retry · hold for review · reverse reservation.
- **Consequence:** `PAYOUT_REVERSAL` idempotency and retry policy.
- **Neutral default architecture:** reserve funds on request; release via one reversal keyed by payout id; retry is a new attempt referencing the same payout. **Answer:**

### 14. Chargeback liability
- **Why it matters:** disputed card payments can exceed the vendor's available balance.
- **Options:** platform · vendor · shared.
- **Consequence:** whether a dispute creates a vendor negative balance and blocks payouts; needs a `Dispute` record.
- **Neutral default architecture:** a `Dispute` entity + liability field + ledger adjustment; never auto-resolve silently. **Answer:**

### 15. Cancellation-after-payment policy
- **Why it matters:** ties order cancellation to refunds.
- **Options:** full refund + cancel · block cancellation once paid · credit only.
- **Consequence:** must preserve the `0012` one-restoration inventory guarantee and create a refund atomically with transition.
- **Neutral default architecture:** order transition and refund are separate idempotent operations joined by a source key. **Answer:**

### 16. Multi-vendor refund allocation
- **Why it matters:** one Checkout maps to several vendor Orders.
- **Options:** per child Order · platform-level pooled.
- **Consequence:** a refund must allocate to specific child Orders and their ledger entries.
- **Neutral default architecture:** `RefundAllocation(refundId, orderId, amountMinor)` with a sum invariant. **Answer:**

### 17. Manual financial adjustments
- **Why it matters:** offline settlements, corrections, goodwill.
- **Options:** finance-only role · admin-only · with mandatory evidence.
- **Consequence:** an `ADJUSTMENT` entry with actor, reason, audit log; a privileged-role design.
- **Neutral default architecture:** adjustment entries require an actor + reason + request id; no silent balance mutation. **Answer:**

### 18. May vendors request withdrawals manually?
- **Why it matters:** whether a vendor-facing payout request flow is built.
- **Options:** yes, vendor-initiated · no, admin-initiated only.
- **Consequence:** payout request form + notification + approval state machine vs admin-only tooling.
- **Neutral default architecture:** `Payout` state machine with a `requestedBy` actor supports both. **Answer:**

### 19. Manual vs automated payouts (initial phase)
- **Why it matters:** whether the platform integrates a payout API at launch.
- **Options:** manual transfers recorded in-app · automated provider payouts.
- **Consequence:** manual needs admin confirmation + reconciliation tooling; automated needs provider payout API + callbacks.
- **Neutral default architecture:** payout records and reversals exist first; the transfer mechanism is an adapter, manual or provider. **Answer:**

### 20. One or multiple currencies
- **Why it matters:** the schema stores an explicit currency per money record.
- **Options:** NGN only · NGN + others.
- **Consequence:** commission/fee tables, receipts, settlement and payouts must be currency-aware; FX is out of scope unless requested.
- **Neutral default architecture:** every amount carries an ISO currency; reject mixed-currency Checkouts; single currency at launch is the simplest. **Answer:**

### Required before implementation (non-policy, technical)
- Introduce the verification-source vocabulary in the section above so `paymentStatus` no longer conflates a vendor report with verified funds.
- Confirm the historical-money audit/backfill approach (all legacy `REAL` order/product rows) before an integer-only ledger reads them.
- Approve an audit-log table for financial actions.
