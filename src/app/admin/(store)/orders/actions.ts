"use server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireStore } from "@/lib/store";
import { canTransitionOrderStatus, ORDER_STATUSES, ACCEPTABLE_STATUSES, VENDOR_CANCELLABLE_STATUSES, ORDER_STATUS_CONFIRMED, ORDER_STATUS_CANCELLED, isRejectionReason } from "@/lib/orders";
import { expireOrderIfStale } from "@/lib/order-expiry";

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

// Vendor acceptance: "I acknowledge this order and intend to fulfil it."
// It never means payment was verified or processed by Larkvine, leaves stock
// reserved, and cannot override an expiry or cancellation that already won.
//
// Acceptance additionally requires the reservation to still be active
// (createdAt > expiryCutoff). A delayed sweep must never let a stale order be
// accepted and hold inventory past its 12-hour window; if the deadline passed,
// the order is expired authoritatively here (stock restored by the 0019 trigger).
export async function acceptOrder(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "vendor")) throw new Error("Unauthorized");
  const store = await requireStore();
  const id = String(formData.get("id"));

  const { env } = await getCloudflareContext({ async: true });
  const placeholders = ACCEPTABLE_STATUSES.map(() => "?").join(",");
  const now = new Date().toISOString();
  const updated = await env.DB.prepare(
    `UPDATE "Order" SET "status" = ?, "acceptedAt" = COALESCE("acceptedAt", ?), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND "storeId" = ? AND "status" IN (${placeholders}) AND ("reservationExpiresAt" IS NULL OR "reservationExpiresAt" > ?) RETURNING "id"`,
  ).bind(ORDER_STATUS_CONFIRMED, now, id, store.id, ...ACCEPTABLE_STATUSES, now).first<{ id: string }>();
  if (!updated) {
    const expiredNow = await expireOrderIfStale(env, id, { storeId: store.id });
    throw new Error(expiredNow
      ? "This order's reservation window has passed, so it expired and the stock was released. It can no longer be accepted."
      : "This order can no longer be accepted — it may have expired or been cancelled.");
  }
  revalidatePath("/admin/orders"); revalidatePath("/admin/dashboard");
}

// Vendor rejection/cancellation before dispatch, with a bounded reason. Stock is
// restored exactly once by the 0012 trigger inside the same statement.
//
// An *unaccepted* order may only be rejected while its reservation is active; a
// stale (past-deadline) order is expired instead, so a late vendor action never
// revives or extends the reservation. A `confirmed` order has already consumed
// its reservation and may be cancelled at any time before dispatch.
export async function rejectOrder(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "vendor")) throw new Error("Unauthorized");
  const store = await requireStore();
  const id = String(formData.get("id"));
  const reason = String(formData.get("reason") ?? "");
  if (!isRejectionReason(reason)) throw new Error("Choose a reason for cancelling this order.");

  const { env } = await getCloudflareContext({ async: true });
  const placeholders = VENDOR_CANCELLABLE_STATUSES.map(() => "?").join(",");
  const now = new Date().toISOString();
  const updated = await env.DB.prepare(
    `UPDATE "Order" SET "status" = ?, "rejectionReason" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND "storeId" = ? AND "status" IN (${placeholders}) AND ("status" = ? OR "reservationExpiresAt" IS NULL OR "reservationExpiresAt" > ?) RETURNING "id"`,
  ).bind(ORDER_STATUS_CANCELLED, reason, id, store.id, ...VENDOR_CANCELLABLE_STATUSES, ORDER_STATUS_CONFIRMED, now).first<{ id: string }>();
  if (!updated) {
    const expiredNow = await expireOrderIfStale(env, id, { storeId: store.id });
    throw new Error(expiredNow
      ? "This order's reservation window has passed, so it expired and the stock was released."
      : "This order can no longer be cancelled.");
  }
  revalidatePath("/admin/orders"); revalidatePath("/admin/dashboard");
}
