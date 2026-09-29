# Vendor and platform-admin system map

Status: code inspection of the checked-in working tree, 2026-09-29. Authorization is enforced server-side and was exercised locally against synthetic D1 accounts (see `docs/VENDOR-ADMIN-AUDIT.md`). Roles are string values on `User.role`: `customer` (default), `vendor`, `admin` (platform super-admin). There is one `admin` role; no support, finance or staff roles exist.

## Authorization primitives

| Primitive | File | Rule |
| --- | --- | --- |
| `auth()` middleware | `src/middleware.ts` | `/admin/*` (except login/signup) requires a signed-in role of `admin` or `vendor`. `/admin`, `/admin/applications`, `/admin/stores` require `admin`; a platform admin is redirected to `/admin/applications` from vendor-only pages. |
| `AdminStoreLayout` | `src/app/admin/(store)/layout.tsx` | Defense in depth: redirects signed-out users; shows a notice for non-approved owned stores; platform admin with no store sees a friendly page, not a throw. |
| `requireStore()` | `src/lib/store.ts` | Signed-in user with an owned store whose status is exactly `approved`, else throws `Unauthorized` / `not been approved yet`. |
| `requirePlatformAdmin()` | `src/lib/store.ts` | Signed-in with role exactly `admin`, else throws `Unauthorized`. |
| Per-action `requireAdmin()` | products/categories/orders/discounts actions | Role must be `admin` or `vendor`; then `requireStore()` scopes the store. |

## Vendor onboarding and account

| Route | Component | Action / API | Authorization | Tables |
| --- | --- | --- | --- | --- |
| `/sell` | `src/app/sell/page.tsx` | link to `/admin/signup` | public | — |
| `/admin/signup` | `src/app/admin/signup/page.tsx` | `POST /api/auth/vendor-signup` | public; creates `User(role=vendor)` + `Store(status=pending)` and optional R2 logo/cover | User, Store |
| `/admin/login` | `src/app/admin/login/page.tsx` | NextAuth credentials | public | User |
| `/account/profile` | `src/app/account/profile/page.tsx` + `actions.ts` | `updateProfile` etc. | signed-in owner | User |

## Vendor store management (requires approved owned store)

| Route | Component | Action | Authorization | Tables | Status |
| --- | --- | --- | --- | --- | --- |
| `/admin/dashboard` | `dashboard/page.tsx` | read-only | `requireStore` | Order, Product | working |
| `/admin/products` | `products/page.tsx` | `deleteProduct` | role + `requireStore`; store-scoped delete | Product, OrderItem, R2 | working; soft-unpublish if sold |
| `/admin/products/new` | `new/page.tsx` + `ProductForm` | `createProduct` | role + `requireStore`; category must belong to store | Product, Category, R2 | working |
| `/admin/products/[id]` | `[id]/page.tsx` + `ProductForm` | `updateProduct` (bound id) | role + `requireStore`; `findFirst({id, storeId})` | Product, Category, R2 | working; cross-vendor rejected |
| `/admin/categories` | `categories/page.tsx` | `createCategory`, `deleteCategory` | role + `requireStore`; parent & delete store-scoped | Category | working |
| `/admin/orders` | `orders/page.tsx` | `updateOrder` | role + `requireStore`; store-scoped guarded D1 update | Order, OrderItem, Product | working |
| `/admin/discounts` | `discounts/page.tsx` | `createDiscount`, `toggleDiscount`, `deleteDiscount` | role + `requireStore`; store-scoped | DiscountCode | working; codes not applied at checkout |
| `/admin/store` | `store/page.tsx` + `StoreProfileForm` | `updateStoreLogo`, `removeStoreLogo`, `updateStoreCover`, `removeStoreCover`, `updateStoreProfile` | role + `requireStore`; only public profile fields writable | Store, R2 | working |

Store settings cannot write `name`, `slug`, `status`, `isVerified`, `approvedAt`, `rejectionReason`, `ownerId` — those are not in the `updateStoreProfile` payload and the form renders the name read-only. Status/verification are platform-admin only.

## Platform-admin (requires `admin`)

| Route | Component | Action | Authorization | Tables | Status |
| --- | --- | --- | --- | --- | --- |
| `/admin/applications` | `applications/page.tsx` + `actions-client.tsx` | `approveApplication`, `rejectApplication` | `requirePlatformAdmin` | Store | working |
| `/admin/stores` | `stores/page.tsx` + `manage-client.tsx`, `verify-client.tsx` | `updateStoreStatus` (suspend/approve), `setStoreVerified` | `requirePlatformAdmin` | Store | working (Suspend/Reactivate bug fixed this pass) |

There is **no** destructive store-delete action or control anywhere in `src` (`deleteStore` has zero references). Store removal is suspension only, preserving orders.

## Missing vendor/admin capabilities (by design so far)

- No variant/inventory-per-size, no archive (only publish toggle + delete), no fulfillment tracking beyond status, no customer-management screen, no financial ledger/payout/commission, no refunds/partial refunds, no disputes, no audit log, no platform-wide order or checkout view, no reports/analytics, no staff/support roles, no notification queue.

## Interaction with checkout (shared invariants)

- A `Checkout` is one customer purchase; each child `Order` belongs to one `Store`. Vendors see only their own child Orders (`where: { storeId: store.id }`).
- `0012` restores stock inside the winning cancellation update; `0015` enforces monotonic transitions; `0016` enforces Order/OrderItem/Product store match; `0017` re-checks store approval and product publication at item insert.
