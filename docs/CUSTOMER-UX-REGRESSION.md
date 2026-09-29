# Customer UX regression baseline

Status: frozen 2026-09-29 after the customer UX + semantic accessibility pass. This checklist is the guard rail for later vendor/admin work. It is a local-fixture baseline, not production evidence. If a shared component (`Header`, `Footer`, `SiteChrome`, `ProductCard`, `ProductDetails`, `Button`, `Input`, global CSS) changes, rerun the commands under "Automation" before claiming the customer surfaces are intact.

## Pages and expected behavior

| Page | Route | Expected `main`/headings | Primary navigation | Primary CTA location | Overflow expectation | Major interactive controls | Cart / order behavior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | `/` | one `<main>`, `h1` "Find something worth keeping." | Header desktop links Shop/Stores/Orders/Account; mobile bottom bar Home/Shop/Orders/Account | Hero: "Browse marketplace", "Browse stores" | none 320–1440 px | search dialog, menu drawer, product cards, store cards | card links to `/{store}/{product}` |
| Shop | `/shop` | one `<main>`, `h1` "Shop the marketplace", sr-only `h2` "Products", cards `h3` (no skip) | filters toolbar, product cards | "Apply filters"; pagination Previous/Next | none 320–1440 px | search, store/category selects, min/max price, sort, mobile filter disclosure | card → product; filters persisted in URL |
| Stores | `/stores` | one `<main>`, `h1` "Marketplace Stores" | store cards | "View store" / storefront link | none 320–1440 px | store cards | store card → `/{store}` |
| Product | `/{store}/{product}` | one `<main>`, `h1` product name, `h2` "About this product" | breadcrumb "Back to store" | desktop Add to Cart; mobile sticky Add to cart above bottom nav | none 320–1440 px | size selector, colour options, quantity, add to cart, image gallery, "Sold by" link | add → persisted `larkvine-cart`; quantity capped at stock |
| Cart | `/cart` | one `<main>`, `h1`; seller-grouped `h2`; items `h3`; Footer columns `h2` (no skip) | grouped by seller | "Proceed to checkout" | none 320–1440 px | quantity change, remove, clear | persists to `larkvine-cart`; empty state "Your cart is empty" |
| Checkout | `/checkout` | one `<main>`, `h1`; grouped by seller | grouped by seller, manual-payment copy | "Place order" | none 320–1440 px | contact/delivery fields, garment size, submit disabled while pending | on submit POST `/api/orders`; idempotent token; redirects to receipt |
| Orders | `/account/orders` | signed-out → Sign In; signed-in one `<main>`, `h1` "My Orders" | "Recent checkouts" / "Earlier Orders" | "Browse marketplace" when empty; "Continue on WhatsApp" per open order | none 320–375 px (long content wraps) | pagination links, WhatsApp return links | only the signed-in user's checkouts/orders; guest receipt is opaque-token gated |
| Confirmation | `/order-confirmation/[checkoutId]` | one `<main>`, `h1` "Thank you" | one seller card per child Order | "Continue with <Store> on WhatsApp" per seller, or support fallback | no overflow at 390/430 px | outbound WhatsApp links (no side effects) | requires owner session or opaque bearer token; `LV-` references; states Larkvine does not process payment |

## Accessibility invariants (must hold)

- Exactly one main landmark per page.
- No heading-level skips (Footer headings are `h2`).
- Every `img` has an `alt` attribute (decorative allowed empty).
- Every interactive element has an accessible name (text, `aria-label`, or associated `label`).
- Keyboard focus is visibly indicated (`a/button/input/select/textarea/summary` get a gold `:focus-visible` outline).
- Mobile menu and search dialogs trap Tab and restore focus to their trigger on Escape.

## Automation

Run with the migrated local D1 fixture and `npm run dev` on port 3000:

| Command | Covers |
| --- | --- |
| `node scripts/audit-viewports.mjs` | overflow at 320/375/390/430/768/1024/1440 px |
| `node scripts/verify-product-mobile.mjs` | sticky mobile CTA position, persistence, desktop hide |
| `node scripts/audit-accessibility.mjs` | axe WCAG 2.2 AA on home/shop/stores/product at 390/1440 px |
| `node scripts/audit-semantics.mjs` | landmarks, headings, accessible names, tab order, focus visibility, dialog focus |
| `node scripts/verify-navigation-browser.mjs` | desktop nav, mobile menu/search focus, filter history, order history |
| `node scripts/verify-checkout-browser.mjs` | two-vendor browser checkout incl. lost-response retry |
| `node scripts/verify-whatsapp-handoff.mjs` | real two-vendor handoff: per-store message isolation, number normalization, no id leakage, no order on click, mobile confirmation |
| `npm test` | money, status, tenancy, cancellation, idempotency, vendor authorization, WhatsApp routing |

Last verified results (2026-09-29): zero overflow at all widths; mobile CTA fixed within 1 px of the bottom nav and hidden at 1024 px; axe zero violations; semantics one main / no heading skips / no unnamed controls / zero invisible focus / dialog focus trapped and restored; `npm test` 25/25; WhatsApp handoff verified (two sellers, isolated messages, normalized numbers, no order on click).
