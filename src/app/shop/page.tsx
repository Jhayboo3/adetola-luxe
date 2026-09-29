import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { displayColor, parseJsonArray } from "@/lib/utils";
import { CATALOG_PAGE_SIZE, catalogHref, catalogOrderBy, catalogWhere, parseCatalogParams } from "@/lib/catalog";
import ProductCard from "@/components/product/ProductCard";
import CatalogFilters from "@/components/catalog/CatalogFilters";

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseCatalogParams(await searchParams);
  const [rows, categories, stores] = await Promise.all([
    prisma.product.findMany({
      where: catalogWhere(filters),
      orderBy: catalogOrderBy(filters.sort),
      skip: (filters.page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE + 1,
      include: { store: { select: { name: true, slug: true, logo: true } } },
    }),
    prisma.category.findMany({ where: { store: { status: "approved" } }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 100, select: { id: true, name: true, store: { select: { name: true } } } }),
    prisma.store.findMany({ where: { status: "approved" }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 100, select: { name: true, slug: true } }),
  ]);
  const hasNext = rows.length > CATALOG_PAGE_SIZE;
  const products = rows.slice(0, CATALOG_PAGE_SIZE).map((product) => ({
    ...product,
    images: parseJsonArray(product.images),
    sizes: parseJsonArray(product.sizes),
    colors: product.colorSelectable ? parseJsonArray(product.colors).map(displayColor) : [],
  }));
  const selectedCategory = categories.find((category) => category.id === filters.category);
  const selectedStore = stores.find((store) => store.slug === filters.store);
  return (
    <div className="py-10 md:py-16">
      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
        <h1 className="font-heading text-[28px] font-medium text-black">Shop the marketplace</h1>
        <p className="mt-2 font-body text-[13px] text-muted">Browse available products from approved Larkvine stores.</p>

        <CatalogFilters filters={filters} categories={categories} stores={stores} />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted"><p>{products.length} products on page {filters.page}{hasNext ? " · more available" : ""}{filters.q ? ` for “${filters.q}”` : ""}</p>{selectedCategory && <p>Category: {selectedCategory.store.name} / {selectedCategory.name}</p>}{selectedStore && <p>Store: {selectedStore.name}</p>}</div>
        <h2 className="sr-only">Products</h2>
        {products.length ? <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">{products.map((product) => <ProductCard key={product.id} product={product} storeSlug={product.store.slug} storeName={product.store.name} storeLogo={product.store.logo} />)}</div>
          : <div className="mt-10 rounded-2xl border border-line px-6 py-16 text-center"><p className="font-heading text-[19px]">No products matched your filters.</p><p className="mt-2 text-[13px] text-muted">Try another keyword, store or price range.</p><Link href="/shop" className="mt-5 inline-block text-[12px] underline">Browse all products</Link></div>}
        <nav aria-label="Catalog pages" className="mt-12 flex justify-between gap-4 text-[13px]">{filters.page > 1 ? <Link href={catalogHref(filters, { page: filters.page - 1 })} className="cta-secondary px-5 py-3">Previous</Link> : <span />}{hasNext && <Link href={catalogHref(filters, { page: filters.page + 1 })} className="cta-secondary px-5 py-3">Next</Link>}</nav>
      </div>
    </div>
  );
}
