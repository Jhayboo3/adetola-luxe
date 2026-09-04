import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import { prisma } from "@/lib/prisma";
import { displayColor, parseJsonArray } from "@/lib/utils";
import ProductDetails from "@/components/product/ProductDetails";
import RelatedProducts from "@/components/product/RelatedProducts";
import { getRelatedProducts } from "@/lib/related";

async function getProductPage(storeSlug: string, productSlug: string) {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 3600 });

  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true, name: true, status: true } });
  if (!store || store.status !== "approved") return null;

  const product = await prisma.product.findFirst({
    where: { storeId: store.id, slug: productSlug, published: true },
    include: { category: true },
  });
  if (!product) return null;

  const related = await getRelatedProducts({ productId: product.id, categoryId: product.categoryId, storeId: store.id });

  return {
    storeName: store.name,
    product: {
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
    },
    related,
  };
}

export default async function StoreProductPage({ params }: { params: Promise<{ store: string; product: string }> }) {
  const { store: storeSlug, product: productSlug } = await params;
  const data = await getProductPage(storeSlug, productSlug);
  if (!data) notFound();

  return (
    <>
      <ProductDetails
        storeSlug={storeSlug}
        storeName={data.storeName}
        product={data.product}
      />
      <RelatedProducts products={data.related} />
    </>
  );
}
