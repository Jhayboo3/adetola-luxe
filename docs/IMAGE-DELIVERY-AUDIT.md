# Product and store image quality / delivery audit

Status: local code inspection plus live measurements against the local dev server on 2026-09-29. No production R2 bucket was inspected; the local fixture has no stored product images, so uploaded-product numbers are pipeline reasoning, not measured payloads. Static-asset numbers are real local measurements.

## Upload and storage pipeline

| Stage | Behavior |
| --- | --- |
| Client compression | `compressImageFile` (`src/lib/image-compress.ts`) resizes the longest edge to **1600 px**, re-encodes to **JPEG q0.8**, before the file joins the form. |
| Client validation | JPG/PNG/WebP only; each original ≤ **30 MB**; ≤10 images per product; ≤20 selected at once (`ProductForm.tsx`). |
| Server validation | `saveImage`/`uploadImage` re-check type against JPG/PNG/WebP and cap at **5 MB** per file (`products/actions.ts`, `store/actions.ts`, `api/auth/vendor-signup/route.ts`). Logo cap **2 MB**; cover cap **5 MB**. |
| Storage | Cloudflare R2 (`PRODUCT_IMAGES`), key `products/<uuid>.<ext>`, `logos/<storeId>-<uuid>.<ext>`, `covers/...`; `contentType` from the client `file.type`; immutable one-year cache metadata. |
| Serving | `GET /api/product-images/[...key]` streams from R2, blocks `..`, sets `X-Content-Type-Options: nosniff`, and only serves `image/jpeg|png|webp|avif|gif` content types, else 404. |
| Rendering | `next/image` with `unoptimized` on product cards, gallery, admin list and form previews (bypasses the Cloudflare `IMAGES` optimizer). Static brand assets use the optimizer. |

## Findings

### F-IMG-1 (P2) — static hero asset is a 9.3 MB PNG mislabeled `.jpg`
`public/hero-image.jpg` is PNG data (1910×2240 RGBA) per `file`, yet is 9,315,685 bytes and served with `Content-Type: image/jpeg` by extension. It is used as the desktop auth-panel background via `next/image` (`fill`, `priority`, `sizes="46vw"`). The optimizer preserves PNG because the source has alpha, so even the optimized background stays large.

| Variant | Bytes | Type | Dimensions |
| --- | ---: | --- | --- |
| raw `/hero-image.jpg` | 9,315,685 | image/jpeg (PNG bytes) | 1910×2240 |
| `/_next/image?...hero w=828 q=75` | 462,118 | image/png | 828 wide |
| `/_next/image?...hero w=1080 q=75` | 732,215 | image/png | 1080 wide |

Recommendation: re-encode to a real JPEG/WebP (opaque, ≤1600 px) and correct the extension, or drop the asset in favour of a CSS/auth-panel treatment. Do not delete the original until the replacement is deployed.

### F-IMG-2 (P3) — oversized brand logos
`public/logomark.png` is 4000×4000 (127,985 B) and preloaded in the header at 40–48 px; `public/brand-logo.png` is 2000×2000 (72,472 B) rendered at 44 px in the footer. The optimizer makes the delivered bytes small, but every source is decoded at full size.

| Variant | Bytes | Dimensions |
| --- | ---: | --- |
| logomark raw | 127,985 | 4000×4000 |
| logomark optimized w=48 / w=96 | 321 / 556 | 48 / 96 |
| brand-logo raw | 72,472 | 2000×2000 |
| brand-logo optimized w=64 / w=256 | 382 / 1,842 | 64 / 256 |

Recommendation: downscale both source files to ~512 px.

### F-IMG-3 (P2) — product media bypasses optimization (`unoptimized`)
Cards, gallery, admin table and form previews render stored R2 images with `unoptimized`, so a phone viewing a grid receives the full compressed upload (up to 1600 px) per card instead of a responsive variant. The `IMAGES` binding is configured in `wrangler.jsonc`, so enabling optimization is available once R2 image access is validated end to end.

### F-IMG-4 (P3) — no broken-image fallback
Product cards/gallery only branch on a missing URL. A stored URL that 404s renders a broken `<img>` (with `unoptimized`, no `onError`). Cloth import fallback is the styled "Image"/product-name placeholder only when there is no URL.

### F-IMG-5 (P3) — no upload de-duplication
Every upload is a fresh UUID object; re-selecting the same photo creates a new R2 object. Old objects are removed on replace/delete, but abandoned form uploads can orphan objects.

### Positives

- Client-side compression keeps the common camera-photo path small and bounded.
- Fixed aspect ratios (`aspect-[3/4]`, gallery `aspect-square`/`aspect-[3/4]`) reserve layout space → low product-image CLS risk; `next/image` uses `fill`+`sizes`.
- Serving route enforces an image-type allowlist and `nosniff`.
- Uploads never overwrite originals; R2 keys are unique.

## Limits

No representative stored product images existed in the local fixture, and no production R2 objects or Cloudflare image-optimizer responses were inspected. `ORIGINAL/RENDERED/TRANSFER/RENDERED-DIMENSIONS` for uploaded products therefore remain **unmeasured**; only the static brand assets were measured. A representative square/portrait/landscape/small/large product and a store logo should be uploaded to staging and measured before switching optimization or claiming a delivery improvement.
