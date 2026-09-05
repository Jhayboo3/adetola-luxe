"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { separateProductIdentity, uploadFileKey } from "@/lib/product-upload";
import { requireStore } from "@/lib/store";

export type ProductFormState = { error?: string; success?: string; completedFiles?: string[] };

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "vendor")) {
    throw new Error("Unauthorized");
  }
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function deleteR2Keys(keys: string[]) {
  if (!keys.length) return;
  const { env } = await getCloudflareContext({ async: true });
  await Promise.all(keys.map((key) => env.PRODUCT_IMAGES.delete(key).catch(() => undefined)));
}

function imageUrlsToKeys(urls: string[]): string[] {
  const prefix = "/api/product-images/";
  return urls
    .filter((url) => url.startsWith(prefix))
    .map((url) => url.slice(prefix.length))
    .filter(Boolean);
}

async function saveImage(file: File) {
  if (!file.size) return null;
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Use a JPG, PNG, or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("The image must be smaller than 5 MB.");

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `products/${crypto.randomUUID()}.${extension}`;
  const { env } = await getCloudflareContext({ async: true });
  await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return { key, url: `/api/product-images/${key}` };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function baseProductData(formData: FormData) {
  const name = text(formData, "name");
  const description = text(formData, "description");
  const price = Number(text(formData, "price"));
  const stock = Number(text(formData, "stock"));
  if (!name || !description) throw new Error("Name and description are required.");
  if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price greater than zero.");
  if (!Number.isInteger(stock) || stock < 0) throw new Error("Stock must be a whole number of zero or more.");

  const compareAtText = text(formData, "compareAt");
  return {
    name,
    slug: slugify(text(formData, "slug") || name),
    description,
    price,
    compareAt: compareAtText ? Number(compareAtText) : null,
    sizes: JSON.stringify(text(formData, "sizes").split(",").map((v) => v.trim()).filter(Boolean)),
    colors: JSON.stringify(formData.getAll("colors").map(String).map((v) => v.trim()).filter(Boolean)),
    colorSelectable: formData.get("colorSelectable") === "on",
    stock,
    clothingType: text(formData, "clothingType") || null,
    targetGender: ["Male", "Female", "Unisex"].includes(text(formData, "targetGender")) ? text(formData, "targetGender") : "Unisex",
    categoryId: text(formData, "categoryId") || null,
    featured: formData.get("featured") === "on",
    published: formData.get("published") === "on",
  };
}

// Upload new images one at a time, recording every key as it lands so a later
// failure can clean up the objects that already made it to R2.
async function uploadImages(files: File[], existingImages: string[], newKeys: string[]): Promise<string[]> {
  const uploads = files.filter((file) => file.size > 0);
  if (uploads.length > 20) throw new Error("Choose no more than 20 images at once.");
  if (uploads.length + existingImages.length > 10) throw new Error("A product can have up to 10 images.");
  const urls: string[] = [];
  for (const file of uploads) {
    const result = await saveImage(file);
    if (result) {
      newKeys.push(result.key);
      urls.push(result.url);
    }
  }
  return urls;
}

async function productData(formData: FormData, existingImages: string[] = [], newKeys: string[] = []) {
  const base = baseProductData(formData);
  const urls = await uploadImages(formData.getAll("images") as File[], existingImages, newKeys);
  return { ...base, images: JSON.stringify([...urls, ...existingImages]) };
}

// A category may only belong to the caller's own store. Cross-store or bogus
// ids would corrupt the catalogue, so reject them up front.
async function ownedCategoryId(storeId: string, categoryId: string | null) {
  if (!categoryId) return null;
  const category = await prisma.category.findFirst({ where: { id: categoryId, storeId }, select: { id: true } });
  if (!category) throw new Error("Choose a valid category for your store.");
  return categoryId;
}

export async function createProduct(_state: ProductFormState, formData: FormData): Promise<ProductFormState> {
  let created = 0;
  const completedFiles: string[] = [];
  const failures: string[] = [];
  const newKeys: string[] = [];
  try {
    await requireAdmin();
    const store = await requireStore();
    const base = baseProductData(formData);
    base.categoryId = await ownedCategoryId(store.id, base.categoryId);
    const files = (formData.getAll("images") as File[]).filter((file) => file.size > 0);
    const separateProducts = formData.get("separateProducts") === "on";
    if (files.length > 20) return { error: "Choose no more than 20 clothing images at once." };

    if (!separateProducts) {
      try {
        const data = await productData(formData, [], newKeys);
        await prisma.product.create({ data: { ...data, storeId: store.id } });
        created = 1;
      } catch (error) {
        await deleteR2Keys(newKeys);
        throw error;
      }
    } else {
      if (!files.length) return { error: "Choose at least one clothing image." };
      const results = await Promise.allSettled(files.map(async (file, index) => {
        let uploaded: { key: string; url: string } | null = null;
        try {
          uploaded = await saveImage(file);
          if (!uploaded) throw new Error("The file was empty.");
          const identity = separateProductIdentity(base.name, text(formData, "slug"), file.name, index, files.length);
          await prisma.product.create({ data: { ...base, ...identity, storeId: store.id, images: JSON.stringify([uploaded.url]) } });
          return { file: uploadFileKey(file) };
        } catch (error) {
          if (uploaded) {
            const { env } = await getCloudflareContext({ async: true });
            await env.PRODUCT_IMAGES.delete(uploaded.key).catch(() => undefined);
          }
          throw new Error(`${file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
        }
      }));
      for (const result of results) {
        if (result.status === "fulfilled") { created++; completedFiles.push(result.value.file); }
        else failures.push(result.reason instanceof Error ? result.reason.message : "Upload failed.");
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { error: "That slug is already in use." };
    return { error: error instanceof Error ? error.message : "Could not create product." };
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/");
  if (failures.length) return { success: `${created} clothing ${created === 1 ? "item" : "items"} uploaded successfully.`, error: `${failures.length} ${failures.length === 1 ? "upload" : "uploads"} failed: ${failures.join(" ")}`, completedFiles };
  redirect(`/admin/products?uploaded=${created}`);
}

export async function updateProduct(id: string, _state: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const newKeys: string[] = [];
  try {
    await requireAdmin();
    const store = await requireStore();
    const current = await prisma.product.findFirst({ where: { id, storeId: store.id } });
    if (!current) return { error: "Product not found." };
    const data = await productData(formData, JSON.parse(current.images), newKeys);
    data.categoryId = await ownedCategoryId(store.id, data.categoryId);
    await prisma.product.update({ where: { id, storeId: store.id }, data });
  } catch (error) {
    await deleteR2Keys(newKeys);
    if (error instanceof Error && error.message.includes("Unique constraint")) return { error: "That slug is already in use." };
    return { error: error instanceof Error ? error.message : "Could not update product." };
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect("/admin/products");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const store = await requireStore();
  const id = text(formData, "id");
  const current = await prisma.product.findFirst({ where: { id, storeId: store.id }, select: { images: true } });
  if (!current) throw new Error("Product not found.");
  const orderCount = await prisma.orderItem.count({ where: { productId: id, storeId: store.id } });
  if (orderCount) {
    // Has sales history: keep the row (soft-unpublish) so order records still resolve.
    await prisma.product.update({ where: { id, storeId: store.id }, data: { published: false } });
  } else {
    let keys: string[] = [];
    try { keys = imageUrlsToKeys(JSON.parse(current.images)); } catch { keys = []; }
    await prisma.product.delete({ where: { id, storeId: store.id } });
    if (keys.length) await deleteR2Keys(keys);
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}
