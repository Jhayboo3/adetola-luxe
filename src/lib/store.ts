import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

// A store is publicly live only once an admin approves it. Pending and rejected
// applications are hidden from the marketplace and their owners cannot manage
// a dashboard until approved.
export const STORE_STATUSES = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  suspended: "suspended",
} as const;

export type StoreStatus = (typeof STORE_STATUSES)[keyof typeof STORE_STATUSES];

// Role string for the platform super admin.
export const ROLE_SUPER_ADMIN = "admin";

// Resolve the store owned by the currently authenticated admin/seller user.
// Only an APPROVED store grants management access — a pending or rejected
// vendor must not reach store-scoped actions. Throws otherwise. Used by admin
// server actions where a store is mandatory.
export async function requireStore() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const store = await prisma.store.findFirst({ where: { ownerId: session.user.id } });
  if (!store) throw new Error("Unauthorized");
  if (store.status !== STORE_STATUSES.approved) {
    throw new Error("Your store has not been approved yet");
  }
  return store;
}

// Non-throwing variant for pages that want to render rather than throw.
// Also returns the store's status so pages can show a pending/rejected notice.
export async function currentStore() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.store.findFirst({ where: { ownerId: session.user.id } });
}

// The platform super admin (Jeremiah). Full, platform-level permissions.
export async function requirePlatformAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== ROLE_SUPER_ADMIN) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export function isSuperAdminRole(role?: string) {
  return role === ROLE_SUPER_ADMIN;
}

// The platform's primary store. Used to scope the legacy single-store pages
// (home, shop, checkout) until per-store routing fully replaces them. Only an
// APPROVED store is a valid default so pending applications never surface.
export async function defaultStore() {
  const store = await prisma.store.findFirst({ where: { status: STORE_STATUSES.approved }, orderBy: { createdAt: "asc" } });
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

// Resolve the WhatsApp number used to notify a store about new orders.
// Priority: the store's own `whatsapp` field, then its `phone`, then the store
// owner's WhatsApp/phone, then the platform default. Digits only, no "+".
export async function storeWhatsapp(storeId: string): Promise<string> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { owner: { select: { whatsapp: true, phone: true } } },
  });
  const raw = store?.whatsapp || store?.phone || store?.owner?.whatsapp || store?.owner?.phone || process.env.WHATSAPP_ORDER_NUMBER || "2347011033320";
  return raw.replace(/\D/g, "");
}
