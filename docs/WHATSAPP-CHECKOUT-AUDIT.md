# WhatsApp checkout and order-routing audit

Status: local code inspection, unit tests and production-build browser/HTTP checks on 2026-09-29. No production data or deployment was touched. Related sources of truth: `AUDIT.md`, `docs/CUSTOMER-UX-REGRESSION.md`, `docs/VENDOR-ADMIN-AUDIT.md`.

## 1. Confirmed business model

Larkvine is an **order-routing marketplace**. It does **not** process, hold, verify or settle customer payments. It has no gateway, wallet, vendor balance, payout, commission deduction, payment ledger, webhook or reconciliation.

```
CUSTOMER CART → CHECKOUT → CREATE LARKVINE ORDER → SPLIT BY VENDOR
→ REDIRECT CUSTOMER TO THE VENDOR'S WHATSAPP → PAYMENT/DELIVERY OUTSIDE LARKVINE
```

The platform independently knows: an order existed, its items/quantities/prices, the assigned vendor, the customer-supplied details, and the vendor-recorded status. It does **not** know whether off-platform payment was actually sent, bank-transfer state, refund completion, or off-platform disputes. All UI copy and terminology now reflect this.

## 2. Checkout architecture

- `POST /api/orders` (`src/app/api/orders/route.ts`) is the only order-creating path. It authenticates optionally (guest allowed), validates the checkout token and customer fields, reloads authoritative products (`published`, `stock > 0`, approved store), re-validates size/colour and price in integer kobo, groups items by store, then inserts one `Checkout` plus one child `Order` per store and its `OrderItem`s in a single D1 batch. Inventory is decremented by the `OrderItem` insert trigger in the same transaction.
- Idempotency: a session-persisted checkout token + canonical request hash (`src/lib/checkout-attempt.ts`, `src/lib/checkout-idempotency.ts`, migration `0013`). A retry with the identical payload replays the same Checkout; a changed payload is rejected (409).
- On success the client clears the cart and navigates to `/order-confirmation/[checkoutId]` (bearer token for guests), which groups child Orders by seller and offers one WhatsApp handoff per seller. No window is auto-opened.

## 3. Order creation findings

| Requirement | Result |
| --- | --- |
| Persisted before WhatsApp opens | Yes — the batch commits before the response; the confirmation page has no side effects. |
| Stable reference | Yes — per-vendor `orderCode` (5-char, unique per store) and a Checkout reference; displayed as `LV-<code>` via `orderReference()`. Internal ids are not shown. |
| Correct vendor attached | Yes — derived from the database product's store, never the request. |
| Products/quantities/prices snapshotted | Yes — persisted on `OrderItem` with `priceMinor` snapshots; client-submitted prices are ignored and re-derived. |
| Customer + delivery persisted | Yes — name, email, phone, WhatsApp, address, city, state, zip, delivery info, gender, garment size. |
| Inventory decremented correctly | Yes — trigger inside the same batch; the `0017` eligibility guard re-checks approval/publication. |
| Duplicate checkout creates one order | Yes — verified by `scripts/verify-checkout-browser.mjs` (three POSTs, one Checkout) and `npm test`. |
| WhatsApp message from persisted data | Yes — message built from server-side values and stored on `Order.notes`; the client only renders it. |

## 4. WhatsApp handoff implementation

- New pure module `src/lib/whatsapp.ts`: `orderWhatsappMessage()`, `whatsappOrderUrl()`, `normalizeWhatsappNumber()`, `orderReference()`, `formatNaira()`.
- The API builds the message from persisted values and stores it on `Order.notes`; the confirmation page and order history reuse that stored message (never rebuilding from the browser).
- No third-party WhatsApp SDK is used; a properly generated `https://wa.me/<digits>?text=<encoded>` URL is sufficient.

## 5. WhatsApp message format

One canonical template (`orderWhatsappMessage`):

```
Hello <Store Name>,

I just placed an order through Larkvine.

Order Reference:
LV-XXXXX

Items:
1. <Product>
   Size: <Size>   Colour: <Colour>
   Qty: <n>
   Price: ₦<line total>

Order Total:
₦<total>

Customer:
<Name>

Delivery Location:
<Address>
<delivery info>

Payment and delivery are arranged directly with you on WhatsApp.
Please confirm availability, payment instructions and delivery details.
```

It excludes database ids, tokens, admin data, other vendors' products and platform metadata; a test asserts no `checkoutToken|tokenHash|requestHash|userId|storeId|productId` appear.

## 6. Multi-vendor handoff

Verified end to end by `scripts/verify-whatsapp-handoff.mjs`: a real two-vendor guest checkout produced exactly two WhatsApp links, each containing only its own store's product; no cross-vendor leakage either way. The confirmation page shows one seller card per child Order with its own CTA and no automatic pop-ups.

## 7. Vendor phone validation

- `normalizeWhatsappNumber()` strips non-digits, converts a local leading `0` to `234`, and rejects implausible lengths (returns `null`). The storefront header and the checkout/confirmation links now share this logic (previously the storefront converted `0→234` while checkout did not, so local-format numbers produced broken `wa.me/0812…` links — fixed).
- `vendorHasContact()` distinguishes a seller-supplied number from the platform fallback. The API returns `whatsappUrl: null` and the confirmation page shows a support path when the seller has no usable contact, instead of silently dialing the platform default and labelling it as the seller.
- Numbers are stored per store and never taken from the request, so a customer cannot forge the recipient. Suspended/pending stores cannot receive new orders (`0017` plus checkout's approval predicate).

## 8. Customer confirmation UX

`/order-confirmation/[id]` shows the checkout reference, `LV-` order references, date, per-seller cards with products/quantities/price snapshots, per-store totals, delivery address, and an explicit statement that Larkvine does not process payment and that payment/delivery are arranged with each seller. One "Continue with <Store> on WhatsApp" CTA per child Order; a support fallback when a seller has no contact.

## 9. Customer order-history UX

`/account/orders` (session-scoped) shows each Checkout and its child Orders grouped by store with `LV-` references, status, vendor-reported payment label, totals, and a "Continue on WhatsApp" link for non-cancelled orders whose seller has a contact. Returning does not create a new order — the link is a plain outbound URL.

## 10. Vendor order UX

`/admin/(store)/orders` is store-scoped, paginated, and shows customer/contact/address, line items, totals, garment size and a guarded status form. No balance/payout/settlement concepts are shown (they do not exist).

## 11. Status model findings

Fulfillment statuses remain `sent_to_whatsapp → pending → confirmed → shipped → delivered` (+ `cancelled`), monotonic and DB-guarded (`0015`). Payment is a separate vendor-reported `paymentStatus` (`pending|paid`) labelled "Vendor-reported payment"; it is never presented as platform-verified. There is no `paid` fulfillment status. An optional `vendor_contact_opened_at` event was considered but not implemented (see owner decisions / next batch).

## 12. Misleading payment language removed

| File | Before | After |
| --- | --- | --- |
| `src/app/terms/page.tsx` | "Payment is processed through the payment channels indicated at checkout. By placing an order you authorise the charge…" | Larkvine does not process payments or hold funds; the order connects the buyer to the seller who arranges payment/delivery directly. |
| `src/app/privacy/page.tsx` | "payment information"; "Process transactions"; "hosting, payment, and delivery" | "delivery information"; "Record and route your orders"; "hosting, communications, and delivery". |
| `src/app/services/page.tsx` | "arrange a resolution or refund"; fee clause | Refunds arranged/issued by the seller; explicit "Larkvine does not process or hold customer payments". |
| `src/app/admin/(store)/dashboard/page.tsx` | "Vendor-reported paid"; "Paid amounts…" | "Vendor-reported payments"; explicit "Larkvine does not process or verify customer payments… marked as received". |

## 13. Inventory-after-abandonment finding

Order creation reserves stock immediately. If the customer opens WhatsApp and never pays, the stock stays reserved until the vendor cancels. There is **no** automatic expiry. This is a **business policy decision**, not implemented. Options: reserve until vendor cancels (current), auto-expire after X (needs a job), or vendor-confirm before permanent reservation. Ask the owner. See `AUDIT.md` recommendation.

## 14. Security findings

| Check | Result |
| --- | --- |
| Customer cannot alter the vendor assigned to an order | Server derives the store from the product row; request has no store field. |
| Customer cannot forge product price | Prices reloaded from the DB; `priceMinor` must equal the integer-kobo legacy value or the item is rejected. |
| Customer cannot forge the WhatsApp number | Number comes from the `Store`/owner record only. |
| Other vendor's products cannot appear in a vendor message | Grouping is by store; the handoff test asserts no cross-vendor items. |
| Vendor cannot access another vendor's order | Store-scoped queries; verified previously (`verify-mutations.mjs`). |
| WhatsApp link exposes only needed info | Message contains seller-visible order data; no ids/tokens; asserted by test. |
| XSS via vendor fields | Number is normalized to digits; the URL is constructed server-side; no arbitrary redirect/URL is accepted. |

## 15. Privacy findings

Vendor contact details (WhatsApp, phone, email, Instagram) are **intentionally public on the storefront** (`src/components/store/StoreHeader.tsx`). The search API and catalog queries select only store `name`/`slug`/`logo`, so private vendor fields are not exposed through autocomplete. Documented for the owner decision on whether the number should remain public or be revealed only after checkout.

## 16. Mobile findings

`scripts/verify-whatsapp-handoff.mjs` measured the two-vendor confirmation page at 390 and 430 px: `documentWidth === viewportWidth` (no overflow) and exactly two WhatsApp CTAs. Existing viewport/semantics/accessible-name checks on the customer pages remain clean.

## 17. Desktop WhatsApp findings

The generated `https://wa.me/...` link is the universal WhatsApp link; on desktop it resolves to WhatsApp Web or prompts to use the desktop/mobile app. No desktop-specific assumption (no `whatsapp://` scheme) is made.

## 18. Analytics event recommendations

No analytics service is configured. If one is added, recommended events: `product_view`, `add_to_cart`, `checkout_started`, `order_created`, `vendor_whatsapp_clicked`. **Never** emit `payment_completed`; `vendor_whatsapp_clicked` is a handoff, not a sale.

## 19–24. Tests, TypeScript, lint, build, responsive

- `npm test`: **25/25** (6 new WhatsApp routing tests + 19 existing).
- New: `tests/whatsapp-routing.test.mjs` — currency parity, phone normalization, references, URL encoding (newline/`&`/`#`/`₦`), single-vendor message contents, cross-vendor isolation, no internal-id leakage, allocation sum.
- New: `scripts/verify-whatsapp-handoff.mjs` — real two-vendor checkout, normalized links, no leakage, no id leakage, opening WhatsApp does not create an order, mobile confirmation at 390/430.
- Browser/HTTP reruns: checkout, navigation, product-mobile, viewports (49 checks), axe (8 scans), semantics, admin viewports (36), admin axe (6), mutations — all pass.
- TypeScript: pass. Lint: pass (one pre-existing warning). Production build: pass. `git diff --check`: only the pre-existing `DEPLOYMENT.md` blank line. `npm audit`: 3 high, 3 moderate, 0 critical (unchanged).
- Known non-regression: production Next 16 output contains an additional **hidden, non-rendered** `<main>` (offsetParent false) on some prerendered routes from the framework's streaming cache; the visible landmark count remains one and axe passes. Not introduced by this pass.

## 25. Files changed this pass

New: `src/lib/whatsapp.ts`, `tests/whatsapp-routing.test.mjs`, `scripts/verify-whatsapp-handoff.mjs`, `docs/WHATSAPP-CHECKOUT-AUDIT.md`.
Changed: `src/lib/store.ts`, `src/app/api/orders/route.ts`, `src/app/order-confirmation/[id]/page.tsx`, `src/app/account/orders/page.tsx`, `src/components/store/StoreHeader.tsx`, `src/app/admin/(store)/dashboard/page.tsx`, `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/app/services/page.tsx`, `AUDIT.md`.

## 26. Owner decisions still required

1. Inventory when the customer never pays the vendor: reserve until vendor cancels, auto-expire (with a time window), or vendor-confirm-before-reserve?
2. May the vendor mark an order "payment received"? (Currently a vendor-reported `paymentStatus` exists; keep or remove?)
3. Can customers cancel before vendor confirmation? (No customer cancellation flow exists today.)
4. Can vendors cancel/reject orders? (They can move to `cancelled`; add a rejection reason?)
5. Vendor WhatsApp number: keep public on the storefront, or reveal only during/after checkout?
6. Keep guest checkout? (Currently supported via bearer token.)
7. Will Larkvine charge vendors separately later? (No fee/invoicing exists; do not build until decided.)

## 27–28. Deployment readiness and production status

No financial code, no migration was added this pass. All P0 mitigations from earlier batches remain **undeployed and production-unverified**. Production-data compatibility remains `BLOCKED — AUTHORIZED EXPORT REQUIRED`. Nothing was deployed or committed.

## 29. Recommended next batch

Customer checkout/handoff hardening polish and owner-decision-driven changes: implement the chosen abandonment rule, optional vendor payment reporting cleanup, cancellation/rejection flows, and `vendor_contact_opened_at` traceability if approved — then the production-data rehearsal gate. Vendor-charging/payout work stays out of scope unless the business model changes.
