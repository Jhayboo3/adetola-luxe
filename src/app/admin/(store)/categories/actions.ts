"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { requireStore } from "@/lib/store";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "vendor")) throw new Error("Unauthorized");
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const store = await requireStore();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim() || null;
  if (!name) throw new Error("Category name is required.");
  if (parentId) {
    const parent = await prisma.category.findFirst({ where: { id: parentId, parentId: null, storeId: store.id }, select: { id: true } });
    if (!parent) throw new Error("Choose a valid top-level category.");
  }
  try {
    await prisma.category.create({ data: { name, slug: slugify(name), description: description || null, parentId, storeId: store.id } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) throw new Error("A category with this name already exists.");
    throw error;
  }
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const store = await requireStore();
  const id = String(formData.get("id") || "");
  const category = await prisma.category.findFirst({ where: { id, storeId: store.id }, include: { _count: { select: { products: true, children: true } } } });
  if (!category) return;
  if (category._count.products || category._count.children) throw new Error("Move its clothing and subcategories before deleting this category.");
  await prisma.category.delete({ where: { id, storeId: store.id } });
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
}
