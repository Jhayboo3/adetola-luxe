import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import type { RelatedProduct } from "@/components/product/RelatedProducts";

/**
 * Build "You May Also Like" suggestions, prioritising products from the same
 * category, then the same store, then featured/trending marketplace products,
 * then any other in-stock products. Never returns the current product.
 */
export async function getRelatedProducts(
  opts: { productId: string; categoryId: string | null; storeId: string },
  limit = 10
): Promise<RelatedProduct[]> {
  type RelatedRow = {
    id: string;
    storeId: string;
    name: string;
    slug: string;
    price: number;
    description: string;
    stock: number;
    images: string;
    store: { slug: string; name: string; logo: string | null };
  };

  const baseWhere: Record<string, unknown> = { published: true, stock: { gt: 0 }, id: { not: opts.productId } };
  const include = { store: { select: { slug: true, name: true, logo: true } } };

  const results: RelatedRow[] = [];

  if (opts.categoryId) {
    const sameCategory = await prisma.product.findMany({
      where: { ...baseWhere, categoryId: opts.categoryId },
      take: limit,
      orderBy: { createdAt: "desc" },
      include,
    });
    results.push(...sameCategory);
  }

  const have = new Set(results.map((r) => r.id));

  const remaining = () => limit - results.length;

  if (remaining() > 0) {
    const sameStore = await prisma.product.findMany({
      where: { ...baseWhere, storeId: opts.storeId },
      take: remaining(),
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      include,
    });
    for (const p of sameStore) {
      if (have.has(p.id)) continue;
      results.push(p);
      have.add(p.id);
    }
  }

  if (remaining() > 0) {
    const featured = await prisma.product.findMany({
      where: { ...baseWhere, featured: true, storeId: { not: opts.storeId } },
      take: remaining() * 2,
      orderBy: { createdAt: "desc" },
      include,
    });
    for (const p of featured) {
      if (results.length >= limit) break;
      if (have.has(p.id)) continue;
      results.push(p);
      have.add(p.id);
    }
  }

  if (remaining() > 0) {
    const any = await prisma.product.findMany({
      where: { ...baseWhere },
      take: remaining() * 3,
      orderBy: { createdAt: "desc" },
      include,
    });
    for (const p of any) {
      if (results.length >= limit) break;
      if (have.has(p.id)) continue;
      results.push(p);
      have.add(p.id);
    }
  }

  return results.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    description: p.description,
    stock: p.stock,
    images: parseJsonArray(p.images),
    storeSlug: p.store.slug,
    storeName: p.store.name,
    storeLogo: p.store.logo ?? null,
  })) as RelatedProduct[];
}
