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

async function deleteUpload(key: string | null, prefix: string) {
  if (!key || !key.startsWith(prefix)) return;
  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.PRODUCT_IMAGES.delete(key);
  } catch {
    // best-effort cleanup
  }
}

function uploadKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = /\/api\/product-images\/(.+)$/.exec(url);
  return match ? match[1] : null;
}

async function uploadImage(file: File | null, folder: string, maxBytes: number, storeId: string): Promise<string | null> {
  if (!file?.size) return null;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) throw new Error("Unsupported image format — please use a JPG, PNG, or WebP image.");
  if (file.size > maxBytes) throw new Error(`Image too large — it must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `${folder}/${storeId}-${crypto.randomUUID()}.${extension}`;
  const { env } = await getCloudflareContext({ async: true });
  await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return `/api/product-images/${key}`;
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
    if (!allowedTypes.includes(file.type)) return { error: "Unsupported file format — please use a JPG, PNG, or WebP image for the logo." };
    if (file.size > 2 * 1024 * 1024) return { error: "Image too large — the logo must be smaller than 2 MB." };

    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const key = `logos/${store.id}-${crypto.randomUUID()}.${extension}`;
    const { env } = await getCloudflareContext({ async: true });
    await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
    });

    const oldKey = uploadKeyFromUrl(store.logo);
    await prisma.store.update({ where: { id: store.id }, data: { logo: `/api/product-images/${key}` } });
    await deleteUpload(oldKey, "logos/");
    revalidateStorePaths(store);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the logo." };
  }
  return { success: "Logo updated." };
}

export async function updateStoreCover(_state: StoreLogoState, formData: FormData): Promise<StoreLogoState> {
  try {
    const store = await canManage();
    const oldKey = uploadKeyFromUrl(store.coverImage);
    const cover = await uploadImage(formData.get("cover") as File | null, "covers", 5 * 1024 * 1024, store.id);
    if (!cover) return { error: "Choose a cover image to upload." };
    await prisma.store.update({ where: { id: store.id }, data: { coverImage: cover } });
    await deleteUpload(oldKey, "covers/");
    revalidateStorePaths(store);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the cover image." };
  }
  return { success: "Cover image updated." };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function removeStoreCover(_state: StoreLogoState, _formData: FormData): Promise<StoreLogoState> {
  try {
    const store = await canManage();
    const oldKey = uploadKeyFromUrl(store.coverImage);
    await prisma.store.update({ where: { id: store.id }, data: { coverImage: null } });
    await deleteUpload(oldKey, "covers/");
    revalidateStorePaths(store);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not remove the cover image." };
  }
  return { success: "Cover image removed." };
}

export async function replaceStoreLogo(_state: StoreLogoState, formData: FormData): Promise<StoreLogoState> {
  try {
    const store = await canManage();
    const oldKey = uploadKeyFromUrl(store.logo);
    const logo = await uploadImage(formData.get("logo") as File | null, "logos", 2 * 1024 * 1024, store.id);
    if (!logo) return { error: "Choose a logo image to upload." };
    await prisma.store.update({ where: { id: store.id }, data: { logo } });
    await deleteUpload(oldKey, "logos/");
    revalidateStorePaths(store);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the logo." };
  }
  return { success: "Logo updated." };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function removeStoreLogo(_state: StoreLogoState, _formData: FormData): Promise<StoreLogoState> {
  try {
    const store = await canManage();
    const oldKey = uploadKeyFromUrl(store.logo);
    await prisma.store.update({ where: { id: store.id }, data: { logo: null } });
    await deleteUpload(oldKey, "logos/");
    revalidateStorePaths(store);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not remove the logo." };
  }
  return { success: "Logo removed." };
}

export type StoreProfileState = { error?: string; success?: string };

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

// Update the store's public profile fields (everything except logo/cover, which
// have their own image upload actions). Callable by the store owner (vendor) or
// a platform admin; store-scoped via requireStore() so pending stores cannot edit
// profile details before approval.
export async function updateStoreProfile(_state: StoreProfileState, formData: FormData): Promise<StoreProfileState> {
  try {
    const store = await canManage();
    const data = {
      category: str(formData, "category") || null,
      country: str(formData, "country") || null,
      state: str(formData, "state") || null,
      city: str(formData, "city") || null,
      area: str(formData, "area") || null,
      physicalAddress: str(formData, "physicalAddress") || null,
      mapLocation: str(formData, "mapLocation") || null,
      pickupAvailable: bool(formData, "pickupAvailable"),
      deliveryAvailable: bool(formData, "deliveryAvailable"),
      whatsapp: str(formData, "whatsapp") || null,
      phone: str(formData, "phone") || null,
      email: str(formData, "email") || null,
      instagramUrl: str(formData, "instagramUrl") || null,
      preferredContactMethod: str(formData, "preferredContactMethod") || null,
      description: str(formData, "description") || null,
      aboutStore: str(formData, "aboutStore") || null,
      productsDescription: str(formData, "productsDescription") || null,
      openingHours: str(formData, "openingHours") || null,
      deliveryAreas: str(formData, "deliveryAreas") || null,
      pickupInformation: str(formData, "pickupInformation") || null,
      paymentMethods: str(formData, "paymentMethods") || null,
      returnPolicy: str(formData, "returnPolicy") || null,
    };
    await prisma.store.update({ where: { id: store.id }, data });
    revalidateStorePaths(store);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update your store profile." };
  }
  return { success: "Store profile saved." };
}
