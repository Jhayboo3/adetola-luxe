import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import ProductCard from "@/components/product/ProductCard";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [products, stores, categories] = await Promise.all([
    prisma.product.findMany({
      where: query
        ? {
            published: true,
            stock: { gt: 0 },
            store: { status: "approved" },
            OR: [
              { name: { contains: query } },
              { description: { contains: query } },
              { store: { name: { contains: query } } },
              { category: { name: { contains: query } } },
            ],
          }
        : { published: true, stock: { gt: 0 }, store: { status: "approved" } },
      orderBy: { createdAt: "desc" },
      include: { store: { select: { slug: true, name: true } } },
    }),
    prisma.store.findMany({
      where: query ? { status: "approved", name: { contains: query } } : { status: "approved" },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.category.findMany({
      where: query ? { name: { contains: query }, store: { status: "approved" } } : { store: { status: "approved" } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true, store: { select: { slug: true, name: true } } },
    }),
  ]);

  const mappedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    description: p.description,
    stock: p.stock,
    images: parseJsonArray(p.images),
    sizes: parseJsonArray(p.sizes),
    colors: parseJsonArray(p.colors),
    storeSlug: p.store.slug,
    storeName: p.store.name,
  }));

  const hasQuery = Boolean(query);
  const total = products.length + stores.length + categories.length;

  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-4 h-[2px] w-12 bg-gold" />
        <h1 className="font-heading text-[28px] font-medium text-black">
          {hasQuery ? `Results for “${query}”` : "Search the Marketplace"}
        </h1>
        <p className="mt-2 font-body text-[13px] text-muted">
          {hasQuery
            ? `${total} ${total === 1 ? "result" : "results"} across products, stores and categories`
            : "Search for products, stores and categories across every vendor on Larkvine."}
        </p>

        <form action="/search" className="mt-8 flex max-w-2xl gap-3">
          <label htmlFor="search-page-input" className="sr-only">Search the marketplace</label>
          <input
            id="search-page-input"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search products, stores, categories..."
            className="min-w-0 flex-1 rounded-full border border-line bg-white px-5 py-3 font-body text-[13px] outline-none transition-colors focus:border-primary"
          />
          <button className="cta-primary min-h-11 px-6 py-3">Search</button>
          {query && <Link href="/search" className="self-center font-body text-[11px] text-muted no-underline">Clear</Link>}
        </form>

        {!hasQuery && (
          <div className="mt-16 text-center">
            <p className="font-heading text-[20px] text-black">Start typing to explore</p>
            <p className="mt-2 font-body text-[13px] text-muted">Find a product by name, a store by its name, or browse categories.</p>
            <Link href="/shop" className="cta-primary mt-6 inline-flex">Browse All Products</Link>
          </div>
        )}

        {hasQuery && total === 0 && (
          <div className="mt-16 rounded-[24px] bg-[#F5F0E9] px-8 py-16 text-center">
            <p className="font-heading text-[20px] text-black">No results found</p>
            <p className="mx-auto mt-2 max-w-md font-body text-[13px] text-muted">
              We couldn’t find anything matching “{query}”. Try a different keyword, a store name, or browse the full catalogue.
            </p>
            <Link href="/shop" className="cta-primary mt-6 inline-flex">Browse All Products</Link>
          </div>
        )}

        {hasQuery && products.length > 0 && (
          <section className="mt-14">
            <div className="flex items-end justify-between">
              <h2 className="font-heading text-[20px] font-medium text-black">Products</h2>
              <span className="font-body text-[11px] uppercase tracking-[2px] text-muted">{products.length}</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:gap-x-6 xl:grid-cols-4">
              {mappedProducts.map((p) => (
                <ProductCard key={p.id} product={p} storeSlug={p.storeSlug} storeName={p.storeName} />
              ))}
            </div>
          </section>
        )}

        {hasQuery && stores.length > 0 && (
          <section className="mt-14">
            <div className="flex items-end justify-between">
              <h2 className="font-heading text-[20px] font-medium text-black">Stores</h2>
              <span className="font-body text-[11px] uppercase tracking-[2px] text-muted">{stores.length}</span>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
              {stores.map((store) => (
                <Link key={store.id} href={`/${store.slug}`} className="group flex items-center gap-4 rounded-[20px] border border-line bg-white p-5 no-underline transition-shadow hover:shadow-[0_12px_40px_rgba(15,42,34,0.08)]">
                  {store.logo ? (
                    <Image src={store.logo} alt={`${store.name} logo`} width={52} height={52} className="h-13 w-13 rounded-full border border-line object-cover" unoptimized />
                  ) : (
                    <div className="flex h-13 w-13 items-center justify-center rounded-full bg-black text-white">
                      <span className="font-heading text-[18px] leading-none">{store.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-heading text-[16px] font-medium text-black">{store.name}</h3>
                    <p className="font-body text-[11px] uppercase tracking-[2px] text-muted">{store._count.products} products</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {hasQuery && categories.length > 0 && (
          <section className="mt-14">
            <div className="flex items-end justify-between">
              <h2 className="font-heading text-[20px] font-medium text-black">Categories</h2>
              <span className="font-body text-[11px] uppercase tracking-[2px] text-muted">{categories.length}</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {categories.map((cat) => (
                <Link key={`${cat.store.slug}-${cat.slug}`} href={`/${cat.store.slug}?category=${cat.slug}`} className="rounded-full bg-[#F5F0E9] px-5 py-2.5 font-body text-[12px] font-medium text-primary no-underline transition-colors hover:bg-primary hover:text-white">
                  {cat.name}
                  <span className="ml-2 font-normal text-muted">· {cat.store.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
