import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import HeroSection from "@/components/home/HeroSection";
import ProductCarousel, { type CarouselProduct } from "@/components/home/ProductCarousel";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";

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

async function getHomeData() {
  const baseWhere = { published: true, stock: { gt: 0 }, store: { status: "approved" } };
  const include = {
    store: { select: { slug: true, name: true, logo: true } },
    category: { select: { name: true, slug: true } },
  };
  const [stores, recent, featured] = await Promise.all([
    prisma.store.findMany({
      where: { status: "approved" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 8,
      include: { _count: { select: { products: { where: { published: true, stock: { gt: 0 } } } } } },
    }),
    prisma.product.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      take: 10,
      include,
    }),
    prisma.product.findMany({
      where: { ...baseWhere, featured: true },
      orderBy: { createdAt: "desc" },
      take: 10,
      include,
    }),
  ]);

  return { stores, recent, featured };
}

async function HomeContent() {
  await connection();
  const { stores, recent, featured } = await getHomeData();
  const newArrivals: CarouselProduct[] = recent.map(toCarousel);
  const featuredProducts: CarouselProduct[] = featured.map(toCarousel);

  return (
    <>
      <HeroSection />

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

      <ProductCarousel title="New arrivals" href="/shop" products={newArrivals} />
      {featuredProducts.length > 0 && <ProductCarousel title="Featured by stores" href="/shop" viewAllLabel="View all" products={featuredProducts} />}
    </>
  );
}

export default function Home() {
  return <HomeContent />;
}
