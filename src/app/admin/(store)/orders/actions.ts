"use server";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStore } from "@/lib/store";
import { ORDER_STATUS_CANCELLED, ORDER_STATUSES } from "@/lib/orders";

export async function updateOrder(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "admin" && role !== "vendor")) throw new Error("Unauthorized");
  const store = await requireStore();
  const id = String(formData.get("id")); const status = String(formData.get("status")); const paymentStatus = String(formData.get("paymentStatus"));
  const statuses = [...ORDER_STATUSES] as string[];
  const paymentStatuses = ["pending", "paid"];
  if (!statuses.includes(status) || !paymentStatuses.includes(paymentStatus)) throw new Error("Invalid order status");

  const order = await prisma.order.findFirst({
    where: { id, storeId: store.id },
    include: { items: { select: { productId: true, quantity: true } } },
  });
  if (!order) throw new Error("Order not found.");

  // Stock is reserved (decremented) when the order is placed. Releasing it back
  // only when moving into `cancelled` means abandoned WhatsApp negotiations no
  // longer permanently drain inventory. Guarded so a repeated cancel cannot
  // double-restore.
  const wasCancelled = order.status === ORDER_STATUS_CANCELLED;
  if (!wasCancelled && status === ORDER_STATUS_CANCELLED && order.items.length) {
    const { env } = await getCloudflareContext({ async: true });
    const statements: ReturnType<typeof env.DB.prepare>[] = order.items.map((item) =>
      env.DB.prepare('UPDATE "Product" SET "stock" = "stock" + ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?').bind(item.quantity, item.productId)
    );
    statements.push(env.DB.prepare('UPDATE "Order" SET "status" = ?, "paymentStatus" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND "storeId" = ?').bind(status, paymentStatus, id, store.id));
    await env.DB.batch(statements);
  } else {
    await prisma.order.update({ where: { id, storeId: store.id }, data: { status, paymentStatus } });
  }
  revalidatePath("/admin/orders"); revalidatePath("/admin/dashboard");
}
