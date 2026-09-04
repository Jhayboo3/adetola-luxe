import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import StoreHeader from "@/components/store/StoreHeader";
import ProductGrid from "@/components/product/ProductGrid";

async function getStoreFront(slug: string) {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 3600 });

  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: store.id, published: true },
      orderBy: { createdAt: "desc" },
      include: { category: true },
    }),
    prisma.category.findMany({
      where: { storeId: store.id },
      orderBy: { name: "asc" },
      select: { name: true, slug: true },
    }),
  ]);

  const mapped = (list: typeof products) =>
    list.map((product) => ({
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      images: parseJsonArray(product.images),
      sizes: parseJsonArray(product.sizes),
      colors: product.colorSelectable ? parseJsonArray(product.colors) : [],
    }));

  const available = products.filter((p) => p.stock > 0);
  const soldOut = products.filter((p) => p.stock <= 0);

  return {
    store: { ...store, createdAt: store.createdAt.toISOString(), updatedAt: store.updatedAt.toISOString() },
    products: mapped(products),
    available: mapped(available),
    soldOut: mapped(soldOut),
    categories,
  };
}

async function getStoreMeta(slug: string) {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 3600 });
  return prisma.store.findUnique({ where: { slug }, select: { name: true, description: true } });
}

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }): Promise<Metadata> {
  const { store: slug } = await params;
  const store = await getStoreMeta(slug);
  if (!store) return { title: "Store not found" };
  return { title: `${store.name} — Storefront`, description: store.description || `Shop ${store.name}'s curated collection.` };
}

function InlineBlock({ title, children }: { title: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <h3 className="font-body text-[11px] font-semibold uppercase tracking-[2px] text-muted">{title}</h3>
      <div className="mt-2 font-body text-[13px] leading-relaxed text-ink/80">{children}</div>
    </div>
  );
}

export default async function StorefrontPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const data = await getStoreFront(slug);
  if (!data || data.store.status !== "approved") notFound();

  const { store, available, soldOut, categories } = data;

  return (
    <>
      <StoreHeader
        name={store.name}
        logo={store.logo}
        coverImage={store.coverImage}
        description={store.description}
        isVerified={store.isVerified}
        city={store.city}
        state={store.state}
        country={store.country}
        whatsapp={store.whatsapp}
        phone={store.phone}
        email={store.email}
        instagramUrl={store.instagramUrl}
        pickupAvailable={store.pickupAvailable}
        deliveryAvailable={store.deliveryAvailable}
      />

      <div className="mx-auto max-w-[1200px] px-8 py-12">
        {/* Store detail info blocks */}
        {(store.aboutStore || store.productsDescription || store.openingHours || store.deliveryAreas || store.pickupInformation || store.paymentMethods || store.returnPolicy) && (
          <div className="mb-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <InlineBlock title="About">{store.aboutStore}</InlineBlock>
            <InlineBlock title="What we sell">{store.productsDescription}</InlineBlock>
            <InlineBlock title="Opening hours">{store.openingHours}</InlineBlock>
            <InlineBlock title="Delivery areas">{store.deliveryAreas}</InlineBlock>
            <InlineBlock title="Pickup information">{store.pickupInformation}</InlineBlock>
            <InlineBlock title="Payment methods">{store.paymentMethods}</InlineBlock>
            <InlineBlock title="Returns & exchange">{store.returnPolicy}</InlineBlock>
          </div>
        )}

        {/* Product categories */}
        {categories.length > 0 && (
          <div className="mb-10">
            <h2 className="font-heading text-[20px] font-medium text-black">Categories</h2>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/shop?category=${cat.slug}`}
                  className="rounded-full border border-line px-4 py-2 font-body text-[12px] text-muted no-underline transition-colors hover:border-primary hover:text-primary"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Available products */}
        <div className="mb-8">
          <div className="mb-4 h-[2px] w-12 bg-gold" />
          <h2 className="font-heading text-[26px] font-medium text-black">Shop the Collection</h2>
          <p className="mt-2 font-body text-[13px] text-muted">
            {available.length} {available.length === 1 ? "product" : "products"} available
          </p>
        </div>
        {available.length === 0 ? (
          <div className="border border-dashed border-line py-16 text-center">
            <p className="font-heading text-[18px] text-black">This store is getting ready</p>
            <p className="mt-2 font-body text-[13px] text-muted">Check back soon for new arrivals.</p>
          </div>
        ) : (
          <ProductGrid products={available} storeSlug={slug} />
        )}

        {/* New arrivals */}
        {available.length > 4 && (
          <>
            <div className="mt-16 mb-6">
              <div className="mb-4 h-[2px] w-12 bg-gold" />
              <h2 className="font-heading text-[24px] font-medium text-black">New Arrivals</h2>
            </div>
            <ProductGrid products={available.slice(0, 4)} storeSlug={slug} />
          </>
        )}

        {/* Sold-out products */}
        {soldOut.length > 0 && (
          <div className="mt-16">
            <div className="mb-4 h-[2px] w-12 bg-gold" />
            <h2 className="font-heading text-[24px] font-medium text-black">Sold Out</h2>
            <p className="mt-2 mb-6 font-body text-[13px] text-muted">
              Recently sold pieces from this store.
            </p>
            <ProductGrid products={soldOut} storeSlug={slug} />
          </div>
        )}
      </div>
    </>
  );
}
