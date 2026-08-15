"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export type ProductFormState = { error?: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    throw new Error("Unauthorized");
  }
}

async function saveImage(file: File) {
  if (!file.size) return null;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) throw new Error("Use a JPG, PNG, or WebP image.");
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
  return `/api/product-images/${key}`;
}

async function saveImages(files: File[], existingImages: string[]) {
  const uploads = files.filter((file) => file.size > 0);
  if (uploads.length > 8) throw new Error("Choose no more than 8 images at once.");
  if (uploads.length + existingImages.length > 10) throw new Error("A product can have up to 10 images.");
  for (const file of uploads) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use only JPG, PNG, or WebP images.");
    if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} must be smaller than 5 MB.`);
  }
  return Promise.all(uploads.map(saveImage));
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function productData(formData: FormData, existingImages: string[] = []) {
  const name = text(formData, "name");
  const description = text(formData, "description");
  const price = Number(text(formData, "price"));
  const stock = Number(text(formData, "stock"));
  if (!name || !description) throw new Error("Name and description are required.");
  if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price greater than zero.");
  if (!Number.isInteger(stock) || stock < 0) throw new Error("Stock must be a whole number of zero or more.");

  const images = await saveImages(formData.getAll("images") as File[], existingImages);
  const compareAtText = text(formData, "compareAt");
  return {
    name,
    slug: slugify(text(formData, "slug") || name),
    description,
    price,
    compareAt: compareAtText ? Number(compareAtText) : null,
    images: JSON.stringify([...images.filter((image): image is string => Boolean(image)), ...existingImages]),
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

export async function createProduct(_state: ProductFormState, formData: FormData): Promise<ProductFormState> {
  try {
    await requireAdmin();
    const data = await productData(formData);
    await prisma.product.create({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { error: "That slug is already in use." };
    return { error: error instanceof Error ? error.message : "Could not create product." };
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect("/admin/products");
}

export async function updateProduct(id: string, _state: ProductFormState, formData: FormData): Promise<ProductFormState> {
  try {
    await requireAdmin();
    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) return { error: "Product not found." };
    const data = await productData(formData, JSON.parse(current.images));
    await prisma.product.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { error: "That slug is already in use." };
    return { error: error instanceof Error ? error.message : "Could not update product." };
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect("/admin/products");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const orderCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderCount) await prisma.product.update({ where: { id }, data: { published: false } });
  else await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}
