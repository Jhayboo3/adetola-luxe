import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import StoreHeader from "@/components/store/StoreHeader";
import StoreDetails from "@/components/store/StoreDetails";
import ProductGrid from "@/components/product/ProductGrid";

const STORE_PAGE_SIZE = 24;

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }): Promise<Metadata> {
  const { store: slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { name: true, description: true, status: true } });
  if (!store || store.status !== "approved") return { title: "Store not found" };
  return { title: `${store.name} — Storefront`, description: store.description || `Shop ${store.name}'s curated collection.` };
}

export default async function StorefrontPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ category?: string | string[]; page?: string | string[] }> }) {
  const { store: slug } = await params;
  const query = await searchParams;
  const category = typeof query.category === "string" ? query.category : "";
  const requestedPage = typeof query.page === "string" ? Number(query.page) : 1;
  const page = Number.isSafeInteger(requestedPage) ? Math.min(1000, Math.max(1, requestedPage)) : 1;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store || store.status !== "approved") notFound();
  const categories = await prisma.category.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" }, take: 100, select: { name: true, slug: true } });
  const activeCategory = categories.some((item) => item.slug === category) ? category : null;
  const categoryWhere = activeCategory ? { category: { slug: activeCategory } } : {};
  const [availableRows, soldOutRows] = await Promise.all([
    prisma.product.findMany({ where: { storeId: store.id, published: true, stock: { gt: 0 }, ...categoryWhere }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * STORE_PAGE_SIZE, take: STORE_PAGE_SIZE + 1 }),
    page === 1 ? prisma.product.findMany({ where: { storeId: store.id, published: true, stock: { lte: 0 }, ...categoryWhere }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 4 }) : Promise.resolve([]),
  ]);
  const hasNext = availableRows.length > STORE_PAGE_SIZE;
  const mapped = (product: (typeof availableRows)[number]) => ({ ...product, images: parseJsonArray(product.images), sizes: parseJsonArray(product.sizes), colors: product.colorSelectable ? parseJsonArray(product.colors) : [] });
  const filteredAvailable = availableRows.slice(0, STORE_PAGE_SIZE).map(mapped);
  const filteredSoldOut = soldOutRows.map(mapped);

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
        {/* Store details — collapsed behind a "More about" dropdown */}
        <StoreDetails
          storeName={store.name}
          blocks={[
            { title: "About", content: store.aboutStore },
            { title: "What we sell", content: store.productsDescription },
            { title: "Opening hours", content: store.openingHours },
            { title: "Delivery areas", content: store.deliveryAreas },
            { title: "Pickup information", content: store.pickupInformation },
            { title: "Payment methods", content: store.paymentMethods },
            { title: "Returns & exchange", content: store.returnPolicy },
          ].filter((block): block is { title: string; content: string } => Boolean(block.content))}
        />

        {/* Product categories */}
        {categories.length > 0 && (
          <div className="mb-10">
            <h2 className="font-heading text-[20px] font-medium text-black">Categories</h2>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {activeCategory && (
                <Link
                  key="all"
                  href={`/${slug}`}
                  className="rounded-full border border-black bg-black px-4 py-2 font-body text-[12px] text-white no-underline transition-colors"
                >
                  All
                </Link>
              )}
              {categories.map((cat) => {
                const isActive = activeCategory === cat.slug;
                return (
                  <Link
                    key={cat.slug}
                    href={`/${slug}?category=${cat.slug}`}
                    aria-current={isActive ? "true" : undefined}
                    className={`rounded-full border px-4 py-2 font-body text-[12px] no-underline transition-colors ${isActive ? "border-black bg-black text-white" : "text-muted hover:border-primary hover:text-primary"}`}
                  >
                    {cat.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Available products */}
        <div className="mb-8">
          <div className="mb-4 h-[2px] w-12 bg-gold" />
          <h2 className="font-heading text-[26px] font-medium text-black">Shop the Collection</h2>
          <p className="mt-2 font-body text-[13px] text-muted">
            {filteredAvailable.length} {filteredAvailable.length === 1 ? "product" : "products"} on page {page}
            {activeCategory ? ` in ${categories.find((cat) => cat.slug === activeCategory)?.name}` : ""}
          </p>
        </div>
        {filteredAvailable.length === 0 ? (
          <div className="border border-dashed border-line py-16 text-center">
            <p className="font-heading text-[18px] text-black">{activeCategory ? "Nothing in this category yet" : "This store is getting ready"}</p>
            <p className="mt-2 font-body text-[13px] text-muted">Check back soon for new arrivals.</p>
          </div>
        ) : (
          <ProductGrid products={filteredAvailable} storeSlug={slug} />
        )}

        {/* New arrivals */}
        {page === 1 && filteredAvailable.length > 4 && (
          <>
            <div className="mt-16 mb-6">
              <div className="mb-4 h-[2px] w-12 bg-gold" />
              <h2 className="font-heading text-[24px] font-medium text-black">New Arrivals</h2>
            </div>
            <ProductGrid products={filteredAvailable.slice(0, 4)} storeSlug={slug} />
          </>
        )}

        {/* Sold-out products */}
        {filteredSoldOut.length > 0 && (
          <div className="mt-16">
            <div className="mb-4 h-[2px] w-12 bg-gold" />
            <h2 className="font-heading text-[24px] font-medium text-black">Sold Out</h2>
            <p className="mt-2 mb-6 font-body text-[13px] text-muted">
              Recently sold pieces from this store.
            </p>
            <ProductGrid products={filteredSoldOut} storeSlug={slug} />
          </div>
        )}
        <nav aria-label="Store product pages" className="mt-12 flex justify-between gap-4">{page > 1 ? <Link href={`/${slug}${activeCategory ? `?category=${encodeURIComponent(activeCategory)}&page=${page - 1}` : `?page=${page - 1}`}`} className="cta-secondary px-5 py-3">Previous</Link> : <span />}{hasNext && <Link href={`/${slug}?${new URLSearchParams({ ...(activeCategory ? { category: activeCategory } : {}), page: String(page + 1) })}`} className="cta-secondary px-5 py-3">Next</Link>}</nav>
      </div>
    </>
  );
}
