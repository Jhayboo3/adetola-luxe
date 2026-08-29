import ProductGrid from "@/components/product/ProductGrid";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { displayColor, parseJsonArray } from "@/lib/utils";
import { defaultStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const category = params.category?.trim() ?? "";
  const store = await defaultStore();
  const [records, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        storeId: store.id,
        published: true,
        stock: { gt: 0 },
        AND: [
          query ? { OR: [{ name: { contains: query } }, { description: { contains: query } }] } : {},
          category ? { OR: [{ category: { slug: category } }, { category: { parent: { slug: category } } }] } : {},
        ],
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ where: { storeId: store.id }, orderBy: [{ parentId: "asc" }, { name: "asc" }], select: { name: true, slug: true, parent: { select: { name: true } } } }),
  ]);
  const products = records.map((product) => ({
    ...product,
    images: parseJsonArray(product.images),
    sizes: parseJsonArray(product.sizes),
    colors: product.colorSelectable ? parseJsonArray(product.colors).map(displayColor) : [],
  }));
  const selectedCategory = categories.find((item) => item.slug === category);
  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-4 h-[2px] w-12 bg-gold" />

        <h1 className="font-heading text-[28px] font-medium text-black">
          {selectedCategory?.name ?? "The Archive"}
        </h1>

        <p className="mt-2 font-body text-[13px] text-muted">
          {products.length} {products.length === 1 ? "product" : "products"} displayed{query ? ` for “${query}”` : ""}
        </p>

        <form id="catalog-search" className="mt-8 flex max-w-2xl gap-3 scroll-mt-28">
          {category && <input type="hidden" name="category" value={category} />}
          <label htmlFor="shop-search" className="sr-only">Search clothing</label>
          <input id="shop-search" name="q" type="search" defaultValue={query} placeholder="Search dresses, kaftans, accessories..." className="min-w-0 flex-1 rounded-full border border-line bg-white px-5 py-3 font-body text-[13px] outline-none transition-colors focus:border-primary" />
          <button className="cta-primary min-h-11 px-6 py-3">Search</button>
          {query && <Link href={category ? `/shop?category=${category}` : "/shop"} className="self-center font-body text-[11px] text-muted no-underline">Clear</Link>}
        </form>

        <div id="categories" className="mt-10 flex scroll-mt-28 flex-wrap gap-3">
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
              {"parent" in cat && cat.parent ? `${cat.parent.name} → ${cat.name}` : cat.name}
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <ProductGrid products={products} />
        </div>

        {products.length === 0 && <div className="py-16 text-center"><p className="font-heading text-[18px] text-black">{category && !query ? "No products are currently available in this category." : "No matching products found."}</p><p className="mt-2 font-body text-[13px] text-muted">Try another name or browse all collections.</p><Link href="/shop" className="mt-5 inline-block font-body text-[11px] uppercase tracking-[2px] text-primary">View all clothing</Link></div>}
      </div>
    </div>
  );
}
