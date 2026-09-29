"use server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStore } from "@/lib/store";
import { canTransitionOrderStatus, ORDER_STATUSES } from "@/lib/orders";

export async function updateOrder(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "vendor")) throw new Error("Unauthorized");
  const store = await requireStore();
  const id = String(formData.get("id")); const status = String(formData.get("status")); const paymentStatus = String(formData.get("paymentStatus"));
  const statuses = [...ORDER_STATUSES] as string[];
  const paymentStatuses = ["pending", "paid"];
  if (!statuses.includes(status) || !paymentStatuses.includes(paymentStatus)) throw new Error("Invalid order status");

  const current = await prisma.order.findFirst({ where: { id, storeId: store.id }, select: { status: true } });
  if (!current) throw new Error("Order not found.");
  if (!canTransitionOrderStatus(current.status, status) || current.status === "cancelled") throw new Error("This order status transition is not allowed.");

  // The status comparison is a compare-and-set guard. If another request
  // changed the order after the read, this update is a no-op and the caller
  // must refresh. Migration 0012 restores stock inside the winning update.
  // Read the row returned by the guarded statement. D1's change count can
  // include trigger writes (inventory restoration) and is not a row-match test.
  const { env } = await getCloudflareContext({ async: true });
  const updated = await env.DB.prepare('UPDATE "Order" SET "status" = ?, "paymentStatus" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND "storeId" = ? AND "status" = ? RETURNING "id"')
    .bind(status, paymentStatus, id, store.id, current.status).first<{ id: string }>();
  if (!updated) throw new Error("Order changed while you were editing. Refresh and try again.");
  revalidatePath("/admin/orders"); revalidatePath("/admin/dashboard");
}
