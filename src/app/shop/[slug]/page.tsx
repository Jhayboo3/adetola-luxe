import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { displayColor, parseJsonArray } from "@/lib/utils";
import ProductDetails from "@/components/product/ProductDetails";
import { defaultStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await defaultStore();
  const product = await prisma.product.findFirst({ where: { storeId: store.id, slug, published: true }, include: { category: true } });
  if (!product) notFound();
  return <ProductDetails storeSlug={store.slug} storeName={store.name} product={{ id: product.id, name: product.name, slug: product.slug, price: product.price, description: product.description, images: parseJsonArray(product.images), sizes: parseJsonArray(product.sizes), colors: parseJsonArray(product.colors).map(displayColor), colorSelectable: product.colorSelectable, stock: product.stock, category: product.category?.name ?? "The Archive" }} />;
}
