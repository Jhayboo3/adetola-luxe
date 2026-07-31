"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
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

  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
    const dataUri = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    const uploaded = await cloudinary.uploader.upload(dataUri, { folder: "adetola-luxe/products", resource_type: "image" });
    return uploaded.secure_url;
  }

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const filename = `${randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/products/${filename}`;
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

  const image = await saveImage(formData.get("image") as File);
  const compareAtText = text(formData, "compareAt");
  return {
    name,
    slug: slugify(text(formData, "slug") || name),
    description,
    price,
    compareAt: compareAtText ? Number(compareAtText) : null,
    images: JSON.stringify(image ? [image, ...existingImages] : existingImages),
    sizes: JSON.stringify(text(formData, "sizes").split(",").map((v) => v.trim()).filter(Boolean)),
    colors: JSON.stringify(formData.getAll("colors").map(String).map((v) => v.trim()).filter(Boolean)),
    colorSelectable: formData.get("colorSelectable") === "on",
    stock,
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
