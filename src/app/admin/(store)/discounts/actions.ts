"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStore } from "@/lib/store";

async function admin() { const session = await auth(); const role = (session?.user as { role?: string })?.role; if (!session?.user || (role !== "admin" && role !== "vendor")) throw new Error("Unauthorized"); }

function positiveOrNull(value: FormDataEntryValue | null): number | null {
  const n = value === null ? NaN : Number(String(value).trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function createDiscount(formData: FormData) {
  await admin(); const store = await requireStore();
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const type = String(formData.get("type"));
  const value = Number(formData.get("value"));
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new Error("Discount code must be 3-20 letters/numbers.");
  if (!["percentage", "fixed"].includes(type)) throw new Error("Invalid discount type.");
  if (!Number.isFinite(value) || value <= 0) throw new Error("Discount value must be greater than zero.");
  if (type === "percentage" && value > 100) throw new Error("A percentage discount cannot exceed 100%.");
  try {
    await prisma.discountCode.create({ data: { code, type, value, storeId: store.id, minOrder: positiveOrNull(formData.get("minOrder")), usageLimit: positiveOrNull(formData.get("usageLimit")) } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) throw new Error("That discount code already exists.");
    throw error;
  }
  revalidatePath("/admin/discounts");
}
export async function toggleDiscount(formData: FormData) { await admin(); const store = await requireStore(); const id = String(formData.get("id")); const current = await prisma.discountCode.findFirst({ where: { id, storeId: store.id } }); if (current) await prisma.discountCode.update({ where: { id, storeId: store.id }, data: { active: !current.active } }); revalidatePath("/admin/discounts"); }
export async function deleteDiscount(formData: FormData) { await admin(); const store = await requireStore(); await prisma.discountCode.delete({ where: { id: String(formData.get("id")), storeId: store.id } }); revalidatePath("/admin/discounts"); }
