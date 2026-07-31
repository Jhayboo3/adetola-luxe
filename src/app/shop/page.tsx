import ProductGrid from "@/components/product/ProductGrid";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const category = params.category?.trim() ?? "";
  const [records, categories] = await Promise.all([
    prisma.product.findMany({ where: { published: true, ...(query ? { OR: [{ name: { contains: query } }, { description: { contains: query } }] } : {}), ...(category ? { category: { slug: category } } : {}) }, orderBy: { createdAt: "desc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true } }),
  ]);
  const products = records.map((product) => ({ ...product, images: parseJsonArray(product.images) }));
  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-4 h-[2px] w-12 bg-gold" />

        <h1 className="font-heading text-[28px] font-medium text-black">
          The Archive
        </h1>

        <p className="mt-2 font-body text-[13px] text-muted">
          {products.length} {products.length === 1 ? "piece" : "pieces"}{query ? ` found for “${query}”` : ""}
        </p>

        <form id="catalog-search" className="mt-8 flex max-w-2xl gap-3 scroll-mt-28">
          {category && <input type="hidden" name="category" value={category} />}
          <label htmlFor="shop-search" className="sr-only">Search clothing</label>
          <input id="shop-search" name="q" type="search" defaultValue={query} placeholder="Search dresses, kaftans, accessories..." className="min-w-0 flex-1 rounded-full border border-line bg-white px-5 py-3 font-body text-[13px] outline-none transition-colors focus:border-primary" />
          <button className="rounded-full bg-primary px-6 py-3 font-body text-[11px] font-semibold uppercase tracking-[1px] text-white transition-colors hover:bg-primary-dark">Search</button>
          {query && <Link href={category ? `/shop?category=${category}` : "/shop"} className="self-center font-body text-[11px] text-muted no-underline">Clear</Link>}
        </form>

        <div className="mt-10 flex flex-wrap gap-3">
          {[{ name: "All", slug: "" }, ...categories].map((cat) => (
            <Link
              key={cat.slug || "all"}
              href={`/shop${cat.slug || query ? `?${new URLSearchParams({ ...(cat.slug ? { category: cat.slug } : {}), ...(query ? { q: query } : {}) }).toString()}` : ""}`}
              className={`font-body text-[11px] font-medium uppercase tracking-[2px] transition-colors ${
                category === cat.slug
                  ? "text-primary"
                  : "text-muted hover:text-primary"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <ProductGrid products={products} />
        </div>

        {products.length === 0 && <div className="py-16 text-center"><p className="font-heading text-[18px] text-black">No matching pieces found</p><p className="mt-2 font-body text-[13px] text-muted">Try another name or browse all collections.</p><Link href="/shop" className="mt-5 inline-block font-body text-[11px] uppercase tracking-[2px] text-primary">View all clothing</Link></div>}
      </div>
    </div>
  );
}
