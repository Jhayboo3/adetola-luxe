import type { Prisma } from "@/generated/prisma/client";
import { koboToNaira, parseNairaToKobo } from "@/lib/money";

export const CATALOG_PAGE_SIZE = 24;
export const CATALOG_MAX_PAGE = 1000;
export const CATALOG_SORTS = ["newest", "price-asc", "price-desc"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

type Params = { q?: string | string[]; category?: string | string[]; store?: string | string[]; minPrice?: string | string[]; maxPrice?: string | string[]; sort?: string | string[]; page?: string | string[] };

export function parseCatalogParams(params: Params) {
  const value = (input?: string | string[]) => typeof input === "string" ? input : "";
  const q = value(params.q).trim().replace(/\s+/g, " ").slice(0, 80);
  const category = value(params.category).trim().slice(0, 100);
  const store = value(params.store).trim().slice(0, 100);
  const requestedSort = value(params.sort);
  const sort: CatalogSort = CATALOG_SORTS.includes(requestedSort as CatalogSort) ? requestedSort as CatalogSort : "newest";
  const rawPage = Number(value(params.page) || 1);
  const page = Number.isSafeInteger(rawPage) ? Math.min(CATALOG_MAX_PAGE, Math.max(1, rawPage)) : 1;
  const parsePrice = (raw?: string | string[]) => {
    const amount = value(raw).trim();
    if (!amount) return null;
    try { return parseNairaToKobo(amount); } catch { return null; }
  };
  const minPriceMinor = parsePrice(params.minPrice);
  const maxPriceMinor = parsePrice(params.maxPrice);
  return { q, category, store, sort, page, minPriceMinor, maxPriceMinor };
}

export type CatalogParams = ReturnType<typeof parseCatalogParams>;

export function catalogWhere(params: CatalogParams): Prisma.ProductWhereInput {
  const price: Prisma.FloatFilter = {};
  if (params.minPriceMinor != null) price.gte = koboToNaira(params.minPriceMinor);
  if (params.maxPriceMinor != null) price.lte = koboToNaira(params.maxPriceMinor);
  return {
    published: true,
    stock: { gt: 0 },
    store: { status: "approved", ...(params.store ? { slug: params.store } : {}) },
    ...(params.category ? { categoryId: params.category } : {}),
    ...(Object.keys(price).length ? { price } : {}),
    ...(params.q ? { OR: [
      { name: { contains: params.q } },
      { description: { contains: params.q } },
      { store: { name: { contains: params.q } } },
      { category: { name: { contains: params.q } } },
    ] } : {}),
  };
}

export function catalogOrderBy(sort: CatalogSort): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === "price-asc") return [{ price: "asc" }, { id: "desc" }];
  if (sort === "price-desc") return [{ price: "desc" }, { id: "desc" }];
  return [{ createdAt: "desc" }, { id: "desc" }];
}

export function catalogHref(params: CatalogParams, overrides: Partial<{ page: number; category: string; store: string; sort: CatalogSort }> = {}) {
  const next = { ...params, ...overrides };
  const search = new URLSearchParams();
  if (next.q) search.set("q", next.q);
  if (next.category) search.set("category", next.category);
  if (next.store) search.set("store", next.store);
  if (next.minPriceMinor != null) search.set("minPrice", String(koboToNaira(next.minPriceMinor)));
  if (next.maxPriceMinor != null) search.set("maxPrice", String(koboToNaira(next.maxPriceMinor)));
  if (next.sort !== "newest") search.set("sort", next.sort);
  if (next.page > 1) search.set("page", String(next.page));
  return `/shop${search.size ? `?${search}` : ""}`;
}
