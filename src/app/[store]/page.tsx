import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import StoreHeader from "@/components/store/StoreHeader";
import ProductGrid from "@/components/product/ProductGrid";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }): Promise<Metadata> {
  const { store: slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { name: true } });
  if (!store) return { title: "Store not found" };
  return { title: `${store.name} — Storefront`, description: `Shop ${store.name}'s curated collection.` };
}

export default async function StorefrontPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store || store.status !== "approved") notFound();

  const products = await prisma.product.findMany({
    where: { storeId: store.id, published: true, stock: { gt: 0 } },
    orderBy: { createdAt: "desc" },
  });
  const mapped = products.map((product) => ({
    ...product,
    images: parseJsonArray(product.images),
    sizes: parseJsonArray(product.sizes),
    colors: product.colorSelectable ? parseJsonArray(product.colors) : [],
  }));

  return (
    <>
      <StoreHeader name={store.name} logo={store.logo} />
      <div className="mx-auto max-w-[1200px] px-8 py-16">
        <div className="mb-8">
          <div className="mb-4 h-[2px] w-12 bg-gold" />
          <h2 className="font-heading text-[26px] font-medium text-black">Shop the Collection</h2>
          <p className="mt-2 font-body text-[13px] text-muted">
            {mapped.length} {mapped.length === 1 ? "product" : "products"} available
          </p>
        </div>
        {mapped.length === 0 ? (
          <div className="border border-dashed border-line py-16 text-center">
            <p className="font-heading text-[18px] text-black">This store is getting ready</p>
            <p className="mt-2 font-body text-[13px] text-muted">Check back soon for new arrivals.</p>
          </div>
        ) : (
          <ProductGrid products={mapped} storeSlug={slug} />
        )}
      </div>
    </>
  );
}
