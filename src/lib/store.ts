import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

// Resolve the store owned by the currently authenticated admin/seller user.
// Throws when there is no authenticated user that owns a store — used by
// admin server actions where a store is mandatory.
export async function requireStore() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const store = await prisma.store.findFirst({ where: { ownerId: session.user.id } });
  if (!store) throw new Error("Unauthorized");
  return store;
}

// Non-throwing variant for pages that want to render rather than throw.
export async function currentStore() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.store.findFirst({ where: { ownerId: session.user.id } });
}

// The platform's primary store. Used to scope the legacy single-store pages
// (home, shop, checkout) until per-store routing fully replaces them.
export async function defaultStore() {
  const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
  if (!store) throw new Error("No store configured");
  return store;
}

// Generate a unique, URL-safe slug from a store name. If the base slug is
// taken, append a numeric suffix until a free one is found.
export async function generateUniqueStoreSlug(name: string): Promise<string> {
  const base = slugify(name) || "store";
  let slug = base;
  let counter = 2;
  while (await prisma.store.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${counter}`;
    counter++;
  }
  return slug;
}
