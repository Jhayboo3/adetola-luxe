"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function admin() { const session = await auth(); if (!session?.user || (session.user as { role?: string }).role !== "admin") throw new Error("Unauthorized"); }
export async function createDiscount(formData: FormData) {
  await admin(); const code = String(formData.get("code") || "").trim().toUpperCase(); const type = String(formData.get("type")); const value = Number(formData.get("value"));
  if (!code || !["percentage", "fixed"].includes(type) || !Number.isFinite(value) || value <= 0) throw new Error("Invalid discount");
  await prisma.discountCode.create({ data: { code, type, value, minOrder: Number(formData.get("minOrder")) || null, usageLimit: Number(formData.get("usageLimit")) || null } }); revalidatePath("/admin/discounts");
}
export async function toggleDiscount(formData: FormData) { await admin(); const id = String(formData.get("id")); const current = await prisma.discountCode.findUnique({ where: { id } }); if (current) await prisma.discountCode.update({ where: { id }, data: { active: !current.active } }); revalidatePath("/admin/discounts"); }
export async function deleteDiscount(formData: FormData) { await admin(); await prisma.discountCode.delete({ where: { id: String(formData.get("id")) } }); revalidatePath("/admin/discounts"); }
