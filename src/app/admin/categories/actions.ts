"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") throw new Error("Unauthorized");
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim() || null;
  if (!name) throw new Error("Category name is required.");
  if (parentId) {
    const parent = await prisma.category.findFirst({ where: { id: parentId, parentId: null }, select: { id: true } });
    if (!parent) throw new Error("Choose a valid top-level category.");
  }
  await prisma.category.create({ data: { name, slug: slugify(name), description: description || null, parentId } });
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
  if (!category) return;
  if (category._count.products || category._count.children) throw new Error("Move its clothing and subcategories before deleting this category.");
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
}
