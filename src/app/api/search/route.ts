import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ products: [], stores: [], categories: [] });

  try {
    const [products, stores, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          published: true,
          stock: { gt: 0 },
          OR: [
            { name: { contains: q } },
            { description: { contains: q } },
            { store: { name: { contains: q } } },
            { category: { name: { contains: q } } },
          ],
        },
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          images: true,
          store: { select: { slug: true, name: true } },
        },
      }),
      prisma.store.findMany({
        where: { name: { contains: q } },
        take: 4,
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, logo: true },
      }),
      prisma.category.findMany({
        where: { name: { contains: q } },
        take: 4,
        orderBy: { name: "asc" },
        select: { slug: true, name: true, store: { select: { slug: true } } },
      }),
    ]);

    return Response.json({
      products: products.map((p) => ({ ...p, image: parseJsonArray(p.images)[0] ?? null })),
      stores,
      categories,
    });
  } catch {
    return Response.json({ products: [], stores: [], categories: [] });
  }
}
