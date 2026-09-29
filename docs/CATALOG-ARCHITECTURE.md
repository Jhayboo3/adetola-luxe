# Marketplace catalog foundation

Status: implemented locally for global listing and bounded search; production and scale verification pending. Category taxonomy remains a business decision.

## Current behavior and eligibility

`/shop` now queries every approved Store's published, in-stock Products. Each card links to its own `/{storeSlug}/{productSlug}` storefront route. `/search` uses the same product eligibility predicate and limits product results to one page. The search API remains an autocomplete-sized response (6 Products, 4 Stores, 4 Categories), with normalized, bounded query text. Store pages query only their own Products and paginate available items. Checkout independently reloads Product and Store data and retains its insert-time eligibility guard.

There is no Product `archived` or soft-delete field. A vendor's delete action unpublishes products with sales history; otherwise it deletes them. The public eligibility predicate uses `published`, positive stock, and Store `approved`. No fabricated rating, sales or availability metric is shown.

## Pagination and filtering

The global catalog uses a fixed 24-product page and fetches one additional row to detect whether Next exists. Page input is clamped to 1–1000; there is no client-selected page size. Ordering always has a unique ID tie-breaker: newest uses `(createdAt DESC, id DESC)`, price ascending uses `(price ASC, id DESC)`, and price descending uses `(price DESC, id DESC)`. This makes pages deterministic while data is unchanged. Offset pagination was chosen for simple numbered-page navigation across multiple sort/filter combinations. New inserts between visits can shift later pages; cursor pagination should be considered if live catalog churn makes that observable. Category, Store, min/max price, sort and query live in the URL. Price inputs are parsed as exact kobo before being converted to the legacy numeric Product price field for filtering; no client-entered price reaches checkout totals.

Current category filtering uses the store-local Category ID and labels it with its Store. It does not pretend identically named vendor categories are one marketplace category. Category and Store selectors each load at most 100 public rows; a larger marketplace needs searchable selectors or a shared taxonomy. The global page deliberately omits an exact total count to avoid an additional query for every filter combination.

## Search

D1/Prisma `contains` on Product name/description and related Store/Category names remains a substring scan. It is normalized for whitespace, limited to 80 characters, and the returned product page is bounded. On an isolated 5,009-product SQLite fixture, an equivalent `%Product 42%` query scanned Product and returned 25 rows at a 0.418 ms p50 local SQLite time before listing indexes; that does not establish Cloudflare production latency or a future growth limit. No external search service or FTS table was added. Revisit FTS only after a larger representative dataset, typo tolerance requirements, and D1 response-time measurements justify it.

## Category model recommendation

The schema has `Category(storeId, slug)` unique per Store. Product points to one Store Category. The local fixture has zero persistent Category rows, so observed data cannot establish whether vendors' same-slug categories mean the same thing. A category URL such as `/category/fashion` would currently be ambiguous; combining names would risk inaccurate navigation and structured data.

Recommend a **hybrid model for owner review**: a curated global marketplace category used for discovery, plus optional vendor-local collections for merchandising. Before implementing it, agree on the global taxonomy, ownership/moderation of categories, whether each Product may have one or multiple global categories, and the migration mapping for existing vendor Categories. An additive migration could introduce `MarketplaceCategory` and a nullable Product foreign key while preserving local Category and existing store URLs; a reviewed backfill would map old rows and leave ambiguous rows unassigned. Only then should clean global `/category/{slug}` routes and canonical metadata be added. No taxonomy migration was made in this pass.

## Query-plan evidence and indexes

An isolated copy of the migrated local D1 schema was populated to 5,009 Products. Each prepared query was warmed 10 times and measured 100 times with Node SQLite. These are engine-level measurements, excluding D1 network and Prisma overhead.

| Query | Before plan / p50 | New index | After plan / p50 |
| --- | --- | --- | --- |
| Global newest, 25 rows | Product scan + temp sort / 0.605 ms | `Product_catalog_newest_idx(published, createdAt DESC, id DESC)` | Index lookup, no temp sort / 0.012 ms |
| Global price ascending | Product scan + temp sort / 0.555 ms | `Product_catalog_price_idx(published, price ASC, id DESC)` | Index lookup, no temp sort / 0.012 ms |
| Global price descending | Product scan + temp sort / 0.629 ms | same price index | Reverse index lookup with temp sort only for ID tie-break / 0.018 ms |
| Substring search | Product scan + temp sort / 0.418 ms | newest listing index | Index-assisted order, substring still scanned / 0.336 ms |
| Vendor newest | existing Store index + temp sort / 0.388 ms | newest listing index | Index-assisted order / 0.012 ms |

Migration `0018_catalog_listing_indexes.sql` adds only the two measured listing indexes. No B-tree index was added for `%substring%` because it cannot satisfy that predicate. Test at representative production cardinality before claiming a production performance gain.

## Caching and private data

Global `/shop`, `/search`, `/stores`, and vendor product lists are read fresh; they are public but availability and suspension changes should appear promptly. The prior vendor storefront remote cache held removed product rows for at least one local test request after deletion, so the unbounded cached product snapshot was replaced with fresh bounded queries. Product detail, homepage and other public cache behavior remain separate audit work. `/account/orders`, checkout, vendor and admin data must remain private and must not enter a shared public cache. Checkout always reloads authoritative Product and Store data.
