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
