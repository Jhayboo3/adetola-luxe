import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { displayColor, parseJsonArray } from "@/lib/utils";
import ProductDetails from "@/components/product/ProductDetails";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({ where: { slug, published: true }, include: { category: true } });
  if (!product) notFound();
  return <ProductDetails product={{ id: product.id, name: product.name, slug: product.slug, price: product.price, description: product.description, images: parseJsonArray(product.images), sizes: parseJsonArray(product.sizes), colors: parseJsonArray(product.colors).map(displayColor), colorSelectable: product.colorSelectable, stock: product.stock, category: product.category?.name ?? "The Archive" }} />;
}
