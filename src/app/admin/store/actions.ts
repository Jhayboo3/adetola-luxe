"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStore } from "@/lib/store";

export type StoreLogoState = { error?: string; success?: string };

async function canManage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "vendor")) throw new Error("Unauthorized");
  return requireStore();
}

async function deleteLogo(key: string | null) {
  if (!key || !key.startsWith("logos/")) return;
  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.PRODUCT_IMAGES.delete(key);
  } catch {
    // best-effort cleanup
  }
}

function logoKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = /\/api\/product-images\/(.+)$/.exec(url);
  return match ? match[1] : null;
}

function revalidateStorePaths(store: { slug: string }) {
  revalidatePath("/");
  revalidatePath("/stores");
  revalidatePath("/shop");
  revalidatePath("/admin");
  revalidatePath("/search");
  revalidatePath(`/${store.slug}`);
  revalidatePath(`/${store.slug}/[product]`);
}

export async function updateStoreLogo(_state: StoreLogoState, formData: FormData): Promise<StoreLogoState> {
  try {
    const store = await canManage();
    const file = formData.get("logo") as File | null;
    if (!file?.size) return { error: "Choose a logo image to upload." };

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) return { error: "Use a JPG, PNG, or WebP image for the logo." };
    if (file.size > 2 * 1024 * 1024) return { error: "The logo must be smaller than 2 MB." };

    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const key = `logos/${store.id}-${crypto.randomUUID()}.${extension}`;
    const { env } = await getCloudflareContext({ async: true });
    await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
    });

    const oldKey = logoKeyFromUrl(store.logo);
    await prisma.store.update({ where: { id: store.id }, data: { logo: `/api/product-images/${key}` } });
    await deleteLogo(oldKey);
    revalidateStorePaths(store);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the logo." };
  }
  return { success: "Logo updated." };
}

export async function removeStoreLogo(_state: StoreLogoState, _formData: FormData): Promise<StoreLogoState> {
  try {
    const store = await canManage();
    const oldKey = logoKeyFromUrl(store.logo);
    await prisma.store.update({ where: { id: store.id }, data: { logo: null } });
    await deleteLogo(oldKey);
    revalidateStorePaths(store);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not remove the logo." };
  }
  return { success: "Logo removed." };
}
