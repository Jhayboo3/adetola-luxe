# Known Issues & Fixes

Runbook of production incidents on **larkvine.org** (OpenNext on Cloudflare Workers +
D1 + R2). Each entry records the symptom, root cause, the fix that shipped, and how to
verify or detect it next time.

---

## 1. Page won't load — raw RSC text on screen, "This page couldn't load" (Sep 2026)

**Status: FIXED** (deployed version `e04c2a4d`, commit `1f4f377` on top of `56f62f6`)

### Symptom
Data-heavy pages (homepage `/`, `/shop`, storefronts like `/tnc-collections`) intermittently
or persistently fail to render. The visible page shows:

- A "This page couldn't load / Reload to try again, or go back." error, and/or
- Leaked garbage text that is actually a cut-off React flight payload, e.g.:

  `orm hover:z-10 hover:-translate-y-1","children":["$","$L8",null,{"src":"/api/product-images/...`

(That `orm hover:...` fragment is the tail of a legit class name `transform hover:z-10 hover:-translate-y-1`
whose `transform` prefix was cut off.)

### Root cause
The homepage and other big pages stream their content through React Suspense. Content is
delivered in `<script>self.__next_f.push([1,"..."])</script>` flight chunks alongside
suspense-reveal scripts (`<script>$RS("S:n","P:n")</script>` / `$RC(...)`).

Cloudflare's worker runtime bridges workerd → Node through a `ReadableByteStream`
(`type:"bytes"`). For reads larger than ~4 KiB the bridge **splits the chunk and can
deliver the tail out of order** — a suspense reveal (plus raw HTML) lands *inside* the
still-open JS string literal:

```
...className":"...transition-transf        ← string cut mid-word
<div hidden id="S:2">...<script>$RS("S:2","P:2")</script>   ← injected mid-string
orm hover:z-10 hover:-translate-y-1\",\"children\":...       ← leaked tail
```

The injected `</script>` terminates the element while the JS string is unterminated →
`SyntaxError` → React never boots → error boundary + raw payload visible.

This is the upstream bug **opennextjs/opennextjs-cloudflare#1130**.

### Why it looked like it "came back"
The repo's fix existed at `56f62f6` but that commit was not yet deployed when the issue
was reported; the live worker was still running the pre-patch build (`947db88`). The
corruption is *deterministic* for a given payload shape, so every request served the same
broken bytes until the patched build was deployed.

### The fix
Two build/verification layers:

1. **`scripts/patch-no-type-bytes.mjs`** (added in `56f62f6`, wired into
   `open-next.config.ts` `buildCommand`). After `next build` it removes `type:"bytes"`
   **only** from `createInlinedDataReadableStream` (the stream that emits
   `self.__next_f.push` scripts) so each flight chunk is delivered whole and in order.
   All other byte streams are untouched. The build aborts if the target pattern is not
   found exactly once, so a Next version bump can't silently skip the patch.
   - Expected deploy log: `[patch-no-type-bytes] patched ... 3 file(s)` covering
     `app-page-turbo.runtime.prod.js`, `app-page-turbo-experimental.runtime.prod.js`,
     and `use-flight-response.js`.

2. **`scripts/check-homepage.mjs`** corruption detector (improved in `1f4f377`). The
   original version only detected the React 16–18 splice form
   (`<div hidden id="S:n">` inside a push) and therefore reported a corrupt React 19
   page as `OK`. It now also detects the React 19 forms:
   - `nestedPush` — a `self.__next_f.push` script whose body contains a nested `<script`
   - `revealLeak` — a `$RS(...)`/`$RC(...)` reveal immediately followed by non-tag text
     (the leaked remainder of the cut flight string)

### How to detect / verify next time
```bash
node scripts/check-homepage.mjs https://larkvine.org/ 5
node scripts/check-homepage.mjs https://larkvine.org/shop 3
node scripts/check-homepage.mjs https://larkvine.org/tnc-collections 3
```
Healthy pages print `OK`; a corrupted page prints `CORRUPT` with nonzero
`nestedPush`/`revealLeak`. Manual smoke test: grep the HTML for the `$RS(` reveal
directly followed by raw (non-`<`) text.

### Redeploy procedure (do this after any relevant change)
```bash
wrangler login
git commit -am "..." && git push
npm run deploy        # confirm "[patch-no-type-bytes] patched ... 3 file(s)" in the log
```
Then wait ~5–15 minutes for corrupt R2 ISR entries to revalidate, or purge immediately:
```bash
wrangler r2 object list larkvine-isr-cache     # inspect keys
wrangler r2 object delete larkvine-isr-cache <key>
```
Re-run `check-homepage.mjs` afterwards. HTML is served `cache-control: no-store`, so no
Cloudflare CDN cache purge is needed.

---

## 2. Cloudflare Workers Error 1102 — CPU limit exceeded (Sep 2026)

**Status: FIXED**

### Symptom
Requests intermittently returned Cloudflare Error 1102 ("Worker exceeded CPU time limit")
on the Cloudflare Free plan's 10 ms CPU budget. Worst on cold cache misses and on the
homepage (highest traffic).

### Root cause
Public read-heavy pages (home, stores, storefront, product) ran Prisma/D1 queries via
server-side rendering on **every request**, and the homepage loaded *every* published
product. Rendering + DB work blew the 10 ms CPU budget whenever the response wasn't warm.

### The fix
1. **`5803217` — Next.js Cache Components.** Enabled `cacheComponents: true` in
   `next.config.ts`; public pages now use `use cache: remote` + `cacheLife(...)` data
   functions backed by OpenNext's R2 incremental cache (`larkvine-isr-cache`) and the
   `NEXT_CACHE_DO_QUEUE` Durable Object, so DB results are served from cache instead of
   re-querying D1 per request. Removed all `force-dynamic` route configs (incompatible
   with cache components) and deferred session-dependent chrome behind `Suspense`.
2. **`82eef68` — bounded homepage query + prewarm.** Homepage now loads a bounded set
   (featured 20 + recent 60, deduped) instead of every product, shrinking the cached RSC
   payload and per-request render cost.
3. **`scripts/prewarm.mjs` + `npm run prewarm`** — after a deploy, warm the R2
   incremental cache for all public routes (static pages, storefronts, and up to 12
   products per store) so real visitors hit warm entries instead of expensive cold misses.

### How to verify next time
- After any deploy run `npm run prewarm`.
- Watch Cloudflare dashboard metrics for Error 1102 and for CPU time; budget is 10 ms on
  the Free plan.
- If CPU spikes return, look for pages still doing un-cached work per request or
  unbounded queries (see `src/app/page.tsx` for the bounded `getHomeData` pattern).

---

## 3. Homepage truncating mid-load (Sep 2026)

**Status: FIXED (mitigation); root cause later fully fixed by #1130 patch (issue 1)**

### Symptom
Homepage occasionally cut off partway down / appeared half-rendered.

### Root cause (initial)
The homepage's content was inside a `<Suspense>` boundary, so the payload streamed in
multiple reveals; a mid-load failure left it visually truncated. This was the visible
surface of the same underlying stream issue as issue 1.

### The fix
- **`947db88`** removed the `<Suspense>` wrapper on the homepage so it renders as one
  unit instead of streaming in reveal stages.
- Later, **issue 1's patch** (`56f62f6`) fixed the actual cause (chunk reordering), so
  streaming reveals are safe again.

### Note
Do not treat "make the page non-streaming" as the long-term fix — the deterministic
cause is the workerd byte-stream reorder addressed in issue 1.

---

## 4. Other fixes shipped in `56f62f6` (order flow + hardening)

- **Order-confirmation redirect** — after placing an order, users were not reliably
  redirected to the confirmation page.
- **Signup password policy** — require strong passwords at account creation.
- **Stock-check null handling** — hardened null handling when checking product stock.
- **`parseJsonArray` sanitization** — tolerate malformed stored JSON instead of throwing.
- **Admin orders "clear" link** and **prewarm fetch** — fixed broken clear link and the
  prewarm fetch used by issue 2's prewarm script.

---

## 5. Code audit — bugs found and fixed (Sep 2026)

Full audit of the order/checkout, auth, product/admin, and storefront code. `tsc` and
ESLint were already clean; the bugs below are logic/security issues that only show at
runtime. Status reflects this run of fixes (not yet committed/deployed at time of writing).

### 5.1 Fixed

1. **Multi-store checkout was not atomic and a retry could silently drop stores** —
   `src/app/api/orders/route.ts`. Each store's order was committed in its own D1 batch;
   if a later store failed, earlier stores were already committed, and the idempotency
   short-circuit then returned only the already-created stores on retry — the customer's
   cart was cleared while a store's items were never ordered. Now **all** stores commit
   in a **single D1 batch** (one transaction — a stock failure rolls every store back),
   and a retry creates any stores missing for that `checkoutToken` instead of returning
   early. A concurrent duplicate submit racing the `(storeId, checkoutToken)` unique
   index now resolves to the already-created orders instead of a 500.

2. **Checkout could strand the customer on a network error** —
   `src/components/checkout/CheckoutClient.tsx`. `await response.json()` inside the click
   handler had no try/catch/finally, so a network/edge failure left the button stuck on
   "Preparing WhatsApp…" forever. The submit is now wrapped, JSON parsing is guarded, and
   failures reset the button and show the error. Also, `window.open` runs only after an
   `await`, which mobile browsers block — so the order-confirmation page now renders a
   real **"Open WhatsApp" button per order** (`order-confirmation/[id]/page.tsx`) that
   works even when the popup was blocked.

3. **Order confirmation could show the wrong store's order (or 404) because it looked
   orders up by the 5-char order code**, which is only unique per store and guessable.
   The order API now returns the unguessable order **id**, the confirmation page looks up
   by id, and WhatsApp numbers are resolved from the store/owner (`storeWhatsappFromRecord`
   in `src/lib/store.ts`). Legacy code-only links still work via a fallback lookup.

4. **Adding to cart could oversell** — `src/components/product/ProductDetails.tsx`.
   The cart merges quantities by product+size+color, but "Add" only checked the new
   quantity against stock, so with stock 3 the shopper could reach 6. Add now counts what
   is already in the cart for that variant, clamps to what's left, and resets the quantity
   to 1 after adding. The server's stock checks/triggers remain the backstop.

5. **Stock reserved by WhatsApp orders was never released** —
   `src/app/admin/(store)/orders/actions.ts`. Stock is decremented when an order is placed,
   but there was no path that restored it, so every abandoned/cancelled negotiation
   permanently drained inventory. Transitioning an order to `cancelled` now restores each
   item's quantity (guarded against double-restore); unknown orders give a clean error
   instead of a raw Prisma `P2025`.

6. **Client-side validation failures were reported as HTTP 500** —
   `src/app/api/orders/route.ts`. Bad size/colour selections in a stale cart were thrown
   and caught by the top-level handler → 500. They are now collected and returned as 422.

7. **Product admin gaps** — `src/app/admin/(store)/products/actions.ts`.
   - `categoryId` from the form was never checked against the caller's store, so a vendor
     could attach another store's (or a bogus) category. Now validated per store.
   - Hard-deleting a product never removed its R2 images; orphaned objects stayed publicly
     served. `deleteProduct` now deletes the product's R2 objects on hard delete.
   - Uploads that succeeded just before a DB write failed (e.g. duplicate slug) were left
     orphaned in R2. New uploads are tracked and cleaned up on failure.

8. **Discount/category validation and raw DB errors** —
   `discounts/actions.ts`, `categories/actions.ts`. Discount codes can now only be
   `[A-Z0-9]{3,20}`, percentage values are capped at 100%, `minOrder`/`usageLimit` must be
   non-negative, and duplicate codes/categories surface a friendly message instead of an
   uncaught `P2002`.

9. **Image endpoint hardening** — `src/app/api/product-images/[...key]/route.ts`. Added
   `X-Content-Type-Options: nosniff` and refuse to serve objects whose stored content type
   isn't in a short image allowlist, so attacker-chosen bytes labeled `image/png` can't be
   sniffed into HTML on the same origin.

10. **Open redirect on login** — `src/app/(auth)/login/page.tsx`. A `callbackUrl` of
    `//evil.com` bypassed the `startsWith("/")` check and hard-navigated off-site. Now
    only single-slash relative paths are allowed. Signup's "Min. 6 characters" copy was
    also fixed to match the server's 8-character minimum.

11. **Admin layout allowed anonymous render** — `src/app/admin/(store)/layout.tsx` now
    explicitly `redirect`s signed-out users to `/admin/login` (defense in depth under the
    middleware matcher).

12. **Storefront category links were broken across three entry points** —
    `src/app/[store]/page.tsx`. Category chips linked to `/shop?category=…`, which is
    scoped to the *default* store (category slugs are only unique per store), and the
    storefront never read `?category` at all — every chip was a dead end or empty page.
    Chips now stay on the current storefront (`/[store]?category=…`), filter the grid and
    counts, and highlight the active category with an "All" reset chip.

### 5.2 Identified but NOT fixed here (action items / known limitations)

- **Secrets & seed credentials (HIGH, do soon).** `prisma/seed.ts`/`seed.sql` create the
  platform super-admin and demo vendors with the committed password `admin123`, and the
  deploy artifact bundles `NEXTAUTH_SECRET="adetola-luxe-secret-key-change-in-production"`
  with `NEXTAUTH_URL=http://localhost:3000` from the local `.env`. Consequences: the super
  admin is protected by a guessable public password, and the baked-in placeholder secret
  means tokens can be forged if it leaks — plus cookies may be issued without `Secure`.
  Actions: rotate the production super-admin password, move the bootstrap password and
  `AUTH_SECRET` into `wrangler secret`/Cloudflare env vars, and remove the `.env` value
  from production builds.
- **No rate limiting on auth endpoints** (login, signup, vendor-signup, forgot/reset
  password). Add a KV/D1 limiter or Cloudflare rate-limit rules on `/api/auth/*`.
- **Password reset does not invalidate existing sessions.** JWT sessions live up to 30
  days and the `jwt` callback never consults the DB, so a reset after compromise leaves
  stolen cookies valid. Needs a `sessionVersion`/`passwordChangedAt` column + async
  `jwt`/`session` revalidation.
- **Cart quantities are still unbounded client-side until the final server check** — the
  cart `+` control has no stock cap (the persisted item doesn't carry stock); the API's
  per-product aggregate check + the DB trigger remain the enforcement point and return 409.
- **Price drift.** The cart stores the price at add-to-cart time; the server recomputes
  from the current DB price, so a vendor editing a price mid-cart means the summary and
  the WhatsApp quote can differ. Re-fetch live prices on checkout or confirm the server
  total before redirect.
- **`uploadFileKey` dedupes by `name:size`**, so two different files with the same name
  and byte size collide in the multi-file picker, and the per-clothing-image create path
  appends a random suffix per attempt — a retry after partial failure creates duplicates
  instead of being idempotent. Key by content hash and make slugs deterministic.
- **`discount` feature is dormant.** Codes can be created but nothing ever applies them or
  enforces `expiresAt`/`usageLimit`; `Order.discount` is always `NULL`.
- **Shipping messaging.** Cart copy says "Calculated at checkout" but no path computes or
  displays shipping; orders hard-code `shipping = 0`. Reconcile the copy or surface
  shipping consistently.
- **`/shop` is still scoped to the default store** while a storefront can link to it from
  legacy entry points; per-store category links now use `[store]?category=` instead.
- **Store logo/cover uploads (vendor-signup) can strand R2 objects** if the user/store DB
  insert fails afterwards, and soft-unpublished products keep their images (intended).

---

## Recurring incident playbook

1. Confirm scope: run `scripts/check-homepage.mjs` against `/`, `/shop`, and a storefront.
2. Grep the raw HTML for leaked flight text: `$RS("S:` immediately followed by
   non-`<` characters is the #1130 signature (React 19). `<div hidden id="S:` inside a
   `self.__next_f.push` is the React 16–18 signature.
3. For #1130: redeploy from a build whose log shows
   `[patch-no-type-bytes] patched ... 3 file(s)`, then re-verify with the detector.
4. For CPU/Error 1102: re-run `npm run prewarm`; check for un-cached or unbounded queries.
5. Remember: the deployed version lags `origin/main` until you run `npm run deploy` —
   "fixed locally but still broken" is almost always "not deployed yet."
