import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { displayColor, parseJsonArray } from "@/lib/utils";
import ProductDetails from "@/components/product/ProductDetails";

export const dynamic = "force-dynamic";

export default async function StoreProductPage({ params }: { params: Promise<{ store: string; product: string }> }) {
  const { store: storeSlug, product: productSlug } = await params;
  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
  if (!store) notFound();
  const product = await prisma.product.findFirst({
    where: { storeId: store.id, slug: productSlug, published: true },
    include: { category: true },
  });
  if (!product) notFound();
  return (
    <ProductDetails
      storeSlug={storeSlug}
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        description: product.description,
        images: parseJsonArray(product.images),
        sizes: parseJsonArray(product.sizes),
        colors: parseJsonArray(product.colors).map(displayColor),
        colorSelectable: product.colorSelectable,
        stock: product.stock,
        category: product.category?.name ?? "The Archive",
      }}
    />
  );
}
