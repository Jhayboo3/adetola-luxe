"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStore } from "@/lib/store";

export async function updateOrder(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "vendor")) throw new Error("Unauthorized");
  const store = await requireStore();
  const id = String(formData.get("id")); const status = String(formData.get("status")); const paymentStatus = String(formData.get("paymentStatus"));
  const statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  const paymentStatuses = ["pending", "paid"];
  if (!statuses.includes(status) || !paymentStatuses.includes(paymentStatus)) throw new Error("Invalid order status");
  await prisma.order.update({ where: { id, storeId: store.id }, data: { status, paymentStatus } });
  revalidatePath("/admin/orders"); revalidatePath("/admin/dashboard");
}
