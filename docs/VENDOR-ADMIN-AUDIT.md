# Vendor and admin operations audit

Status: local code inspection plus automated browser/HTTP checks against synthetic D1 fixtures, 2026-09-29. No production data or deployment was touched. The route/authorization map is in `docs/VENDOR-ADMIN-MAP.md`. Authorization evidence is in `AUDIT.md` and `scripts/verify-admin-actions.mjs`.

## 1. Vendor dashboard (Phase 77)

The dashboard shows four counters — **Vendor-reported paid** (sum of `total` where `paymentStatus="paid"` and not cancelled), **Orders**, **Products**, **Low Stock** (published products with `stock ≤ 3`) — and the five most recent orders with a friendly status label.

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| DASH-1 | P2 | No "needs fulfillment" signal. A vendor cannot see how many orders are awaiting confirmation/shipment without scanning the paged order list. | Add status counts (e.g. new/pending, confirmed, shipped) derived from the vendor's own orders. No new data needed. |
| DASH-2 | P3 | "Low Stock" merges out-of-stock (0) with low stock and counts only published products. | Split "Out of stock" from "Low stock" and count drafts separately. |
| DASH-3 | P3 | No units-sold or best-selling signal. | Add only if genuinely useful; derive from OrderItem quantity, never fabricate popularity on the storefront. |

Financial wording is accurate: the figure is explicitly "reported by your store … not verified by Larkvine". No balance/settlement language was found. No fix required.

## 2. Product management (Phase 78)

Store-scoped and verified: creating, editing, deleting, price/stock changes and publish/unpublish all run through `requireStore()` with `findFirst({ id, storeId })` / `update({ where: { id, storeId } })`. Cross-vendor and suspended-vendor attempts mutate nothing (see section 8).

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| PROD-1 | P2 | Delete is one click from the list with no confirmation. With sales history it only unpublishes; without it deletes the row and R2 images. | Add a confirm step and label the outcome ("This product has orders; it will be hidden, not deleted"). |
| PROD-2 | P3 | "Create each image as a separate clothing product" is checked by default on new products, so a multi-image upload silently creates many products. | Default off when more than one image is selected, or explain the effect inline. |
| PROD-3 | P3 | Uploads trust the client `file.type`; no magic-byte check server-side. Serving route mitigates sniffing with `nosniff` + an image-type allowlist. | Validate signatures server-side when hardening the media pipeline. |
| PROD-4 | P3 | Editing an image-less product leaves `images` as re-serialized existing values; no archive state exists beyond publish/delete. | Consider an explicit archive only if vendors request it. |

## 3. Product form UX (Phase 79)

Review of `ProductForm.tsx`: required name, price (>0, naira, step 0.01) and whole-number stock; description optional; clothing type, gender, sizes (comma list), colour options, category, publish/featured flags. No kobo values, database IDs or internal enum names reach the vendor — prices display in `₦`, categories by name, gender via a select. `parseNairaToKobo` rejects more than two decimals server-side.

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| FORM-1 | P3 | Validation errors surface as a single banner, not tied to the offending field. | Add per-field messages as the form grows. |
| FORM-2 | P3 | Price and stock rely on native HTML validation plus server checks; "Old Price" has no relation check against price. | Warn when old price ≤ price. |

## 4. Inventory experience (Phase 80)

One `Product.stock` integer is shared across all sizes and colours. Sizes/colours are JSON option lists only. The UI does not falsely imply per-variant inventory: the product page shows a single "Only N left"/"In Stock", and the quantity stepper shows the shared "N in stock". No per-variant stock exists or is claimed.

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| INV-1 | P1 (business risk) | A vendor expecting "S=4, M=10, L=0" cannot express that. With stock=14 the size selector still offers L until shared stock reaches zero, so a specific size can oversell relative to the vendor's mental model. | Confirm the operating model with the owner. If per-size stock is needed, add a `ProductVariant(productId, size, color, stock)` table and move the inventory trigger to the variant; keep the shared count as the fallback for products with no variants. Do not implement until approved. |

## 5. Vendor order management (Phase 81)

Store-scoped list with free-text search over code/customer/email/phone. Each order shows customer name, phone/email, address, line items, total, date, garment size and a guarded status form. Status options are filtered by `canTransitionOrderStatus`; labels use `ORDER_STATUS_LABELS` (no raw enum names). The update is a store-scoped compare-and-set D1 statement; `0012` restores stock inside the winning cancellation.

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| ORD-1 | P2 | Cancellation is one option in the status dropdown with no confirmation or explanation that it restores stock and cannot be undone. | Require an explicit confirm with the inventory effect stated. |
| ORD-2 | P2 | The list previously loaded every store order unbounded. | **Fixed this pass:** paginated 25/page with a stable `(createdAt, id)` order. |
| ORD-3 | P3 | No dedicated order-detail page or fulfilment notes. | Add later if volume requires. |

## 6. Vendor customer-data privacy (Phase 82)

A vendor's order query is `where: { storeId: store.id }`, so it can only see its own child Orders. It receives customer name, phone/email, delivery address, garment size/measurements and line items — the minimum needed to fulfill that order. It does **not** receive: other vendors' orders in the same Checkout, the Checkout-level total across sellers, or other customers' data. The storefront/checkout never place private data in a public cache. Boundary documented; no leak found. No raw internal IDs beyond the store's own order code are shown.

## 7. Vendor store settings (Phase 83)

`updateStoreProfile` writes only public profile fields. It cannot change `name`, `slug`, `status`, `isVerified`, `approvedAt`, `rejectionReason` or `ownerId`; the name is rendered read-only and the slug/status/verification columns are absent from the payload. Logo/cover changes are store-scoped and clean up the previous R2 object. A suspended/pending vendor cannot reach settings because `requireStore()` requires `approved` and the layout shows a status notice.

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| STORE-1 | P3 | `revalidatePath("/", "layout")` on profile save is broad but harmless. | Leave as-is. |

## 8. Authorization evidence (Phases 78, 85)

- **Bound cross-vendor product edit:** `scripts/verify-product-edit-browser.mjs` replays a captured Vendor B edit POST under Vendor A and under a suspended Vendor A: price, stock and unpublish attempts all leave B's row identical; B's edit page does not render for A. Reproduced this pass.
- **Admin actions:** `scripts/verify-admin-actions.mjs` captures a real admin `updateStoreStatus`/`setStoreVerified` POST and replays it as anonymous, customer, vendor A and the store's own vendor B: the row is unchanged for all four; only the real admin applies suspension and verification. No destructive store-delete control exists (0 matches; `deleteStore` absent from `src`).
- **Bug fixed:** `StoreManageActions` built a `FormData` containing `status` but `run()` discarded it and sent only `id`, so Suspend/Reactivate silently failed with "Invalid request". Fixed; the suspend path now applies and was verified end to end.

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| AUTHZ-1 | P2 | Unauthorized server-action calls return HTTP 200 with a serialized error payload (or 500), not 403/404. Hiding UI is not the protection, but monitoring can't rely on status alone. | Map action failures to clean statuses/messages without leaking tenant existence. |
| AUTHZ-2 | P1 | **Fixed:** admin store suspend/reactivate did nothing (discarded form field). | Regression-covered manually; add a browser assertion to CI later. |

## 9. Store moderation (Phase 86)

Statuses: `pending`, `approved`, `rejected`, `suspended`. Effects: only `approved` stores are publicly eligible (`/shop`, `/stores`, storefront, checkout re-check in `0017`); a `suspended` storefront is hidden and the vendor's dashboard is replaced by a "Store suspended" notice; `rejected` shows the reason; `pending` waits for review. Admin UI explains that suspension preserves order history.

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| MOD-1 | P2 | The admin UI states the suspend effect but not the full consequence matrix (what pending/rejected/suspended each mean for listings and new orders). | Add concise per-status helper text in the admin lists. |

## 10. Admin order operations (Phase 87)

There is no platform-wide order or Checkout view. The platform admin manages orders only through an owned store (the same vendor page), so they cannot search across all marketplace orders, cannot see a Checkout's grouped vendor Orders, and have no order-detail page.

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| AORD-1 | P1 | Platform admin lacks a marketplace-wide order/checkout view and cannot distinguish Checkout from child Order in the UI. | Add a read-only admin orders view listing Checkouts with their child Orders grouped by store, plus filtering. Cancellation must keep the `0012` one-restoration guarantee. |
| AORD-2 | P2 | Order search is per-store only. | Covered by AORD-1. |

## 11. Financial language (Phase 88)

No verified gateway, ledger, balance or payout exists, and the UI does not pretend otherwise: dashboard "Vendor-reported paid" with an explicit unverified note; order form labelled "Vendor-reported payment"; customer receipt "Vendor marked payment received"; no "Available balance"/"settled"/"payable"/"commission" anywhere. Customer/vendor-reported and admin-confirmed states are not fabricated because the schema only stores a vendor-set `paymentStatus`.

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| FIN-1 | P2 | `paymentStatus` conflates vendor report with truth; there is no stored verification source. | When payments are built, add an explicit verification state (`manual_unverified`/`vendor_reported`/`admin_confirmed`/`platform_verified`) rather than overloading `paymentStatus`. See `docs/MARKETPLACE-FINANCIAL-DECISIONS.md`. |

## 12. Responsive (Phase 91)

`scripts/audit-admin-viewports.mjs` rendered 7 vendor pages and 2 platform pages at 390/768/1024/1440 px (36 checks): **zero document overflow**. Product and discount tables are intentionally contained in `overflow-x-auto` wrappers.

## 13. Accessibility (Phase 92)

`scripts/audit-admin-accessibility.mjs` (axe, WCAG 2.2 AA) on dashboard, product form, orders, store settings, admin stores, applications. Fixes this pass:

- `StoreProfileForm`: labels were visually adjacent but not associated. Added a `Field` wrapper using `useId`/`cloneElement` so every input/select/textarea gets a real `htmlFor`/`id`.
- `ProductForm` "(optional)" hint used `text-muted/70` (contrast fail) → `text-muted`.
- Admin order price used gold-on-white (contrast fail) → `text-primary-dark`.
- Global `:focus-visible` gold outline added for links/buttons/inputs/selects/textareas/summary.

Result after fixes: **zero axe violations** on all six pages. Manual review: forms are labelled, order actions are labelled selects, status chips have text. Remaining manual screen-reader pass is blocked (no runtime).

## 14. Error and empty states (Phase 93)

Vendor: friendly empties for no products ("No clothing uploaded yet"), no orders ("No orders yet"/"No orders found for …"). Store pending/rejected/suspended have dedicated notices; suspended vendors are blocked from the dashboard. Admin: "No stores yet"/"No store applications yet". Stale order conflict gives "Order changed while you were editing. Refresh and try again." Upload/save failures return a message.

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| ERR-1 | P2 | Server-action catch blocks return `error.message` verbatim; unusual DB errors could leak internal text. | Map unexpected errors to generic copy and log sanitized diagnostics. |

## 15. Performance (Phase 94)

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| PERF-1 | P2 | Admin orders fetched every store order with items + product. | **Fixed this pass:** 25/page, stable order, one extra row to detect Next. |
| PERF-2 | P2 | Admin products fetched every store product. | **Fixed this pass:** 50/page with the same pattern. |
| PERF-3 | P3 | `/admin/stores` and `/admin/applications` load every store globally with `_count` relations. | Fine at current scale; add pagination when store count grows. |
| PERF-4 | P3 | Dashboard uses `Promise.all` for its four aggregates. | Acceptable. |

## 16. Test expansion (Phase 95)

Added `tests/vendor-authorization.test.mjs`: store-scoped guarded order update cannot touch another store; allowed transition applies; store-scoped reads never expose another store's customer/order; suspending a store removes it from the public eligibility predicate; monotonic transition matrix. `npm test` is now 20/20. The admin HTTP replay coverage lives in `scripts/verify-admin-actions.mjs` (not yet wired into CI).
