import HeroSection from "@/components/home/HeroSection";
import FeaturedCollections from "@/components/home/FeaturedCollections";
import NewArrivals from "@/components/home/NewArrivals";
import EditorialNote from "@/components/home/EditorialNote";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { published: true, stock: { gt: 0 } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.category.findMany({ include: { products: { where: { published: true, stock: { gt: 0 } }, orderBy: { createdAt: "desc" }, take: 1 } }, take: 3 }),
  ]);
  const arrivals = products.map((product) => ({ id: product.id, name: product.name, price: product.price, slug: product.slug, images: parseJsonArray(product.images) }));
  const featured = categories.map((category) => ({ name: category.name, slug: category.slug, image: category.products[0] ? parseJsonArray(category.products[0].images)[0] ?? null : null }));
  return (
    <>
      <HeroSection />
      <FeaturedCollections collections={featured} />
      <NewArrivals products={arrivals} />
      <EditorialNote />
    </>
  );
}
