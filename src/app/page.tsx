import Link from "next/link";
import Image from "next/image";
import HeroSection from "@/components/home/HeroSection";
import ProductCarousel, { type CarouselProduct } from "@/components/home/ProductCarousel";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

function toCarousel(item: { id: string; name: string; slug: string; price: number; description: string; stock: number; images: string; store: { slug: string; name: string; logo?: string | null } }): CarouselProduct {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    price: item.price,
    description: item.description,
    stock: item.stock,
    images: parseJsonArray(item.images),
    storeSlug: item.store.slug,
    storeName: item.store.name,
    storeLogo: item.store.logo ?? null,
  };
}

export default async function Home() {
  const [stores, allProducts] = await Promise.all([
    prisma.store.findMany({
      where: { status: "approved" },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.product.findMany({
      where: { published: true, stock: { gt: 0 }, store: { status: "approved" } },
      orderBy: { createdAt: "desc" },
      include: {
        store: { select: { slug: true, name: true, logo: true } },
        category: { select: { name: true, slug: true } },
      },
    }),
  ]);

  const newArrivals: CarouselProduct[] = allProducts.slice(0, 10).map(toCarousel);
  const trending: CarouselProduct[] = allProducts.filter((p) => p.featured).slice(0, 10).map(toCarousel);

  // Group products into marketplace category sections (across all stores).
  const byCategory = new Map<string, { name: string; slug: string; products: CarouselProduct[] }>();
  for (const product of allProducts) {
    const name = product.category?.name ?? "Other";
    const slug = product.category?.slug ?? "other";
    if (!byCategory.has(name)) byCategory.set(name, { name, slug, products: [] });
    const bucket = byCategory.get(name)!;
    if (bucket.products.length < 10) bucket.products.push(toCarousel(product));
  }

  return (
    <>
      <HeroSection
        storeCount={stores.length}
        productCount={allProducts.length}
        stores={stores.map((s) => ({ name: s.name, slug: s.slug, logo: s.logo }))}
      />

      {/* Marketplace store directory */}
      <section className="py-8 md:py-12">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-heading text-[22px] font-medium text-black md:text-[28px]">Shop by Store</h2>
            <Link href="/stores" className="font-body text-[11px] font-medium uppercase tracking-[2px] text-primary no-underline transition-colors hover:text-primary-light">All Stores</Link>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 [scrollbar-width:thin]">
            <div className="flex w-max gap-4">
              {stores.map((store) => (
                <Link key={store.id} href={`/${store.slug}`} className="group flex w-[180px] shrink-0 flex-col items-center gap-3 rounded-[20px] border border-line bg-white p-6 text-center no-underline transition-shadow hover:shadow-[0_10px_30px_rgba(15,42,34,0.08)]">
                  {store.logo ? (
                    <Image src={store.logo} alt={`${store.name} logo`} width={56} height={56} className="h-14 w-14 rounded-full border border-line object-cover" unoptimized />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white">
                      <span className="font-heading text-[20px] leading-none">{store.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span className="font-heading text-[15px] font-medium text-black">{store.name}</span>
                  <span className="font-body text-[10px] uppercase tracking-[2px] text-muted">{store._count.products} products</span>
                </Link>
              ))}
            </div>
          </div>
          {stores.length === 0 && <div className="rounded-[24px] bg-[#F5F0E9] px-8 py-14 text-center font-body text-[13px] text-muted">No stores open yet.</div>}
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
        <div className="border-t border-line" />
      </div>

      <ProductCarousel title="New Arrivals" href="/shop" products={newArrivals} />
      {trending.length > 0 && <ProductCarousel title="Trending" href="/shop" viewAllLabel="View All" products={trending} />}

      {[...byCategory.values()].map((section) => (
        <ProductCarousel key={section.slug} title={section.name} products={section.products} />
      ))}
    </>
  );
}
