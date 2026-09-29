"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { CUSTOMER_CANCELLABLE_STATUSES, ORDER_STATUS_CANCELLED } from "@/lib/orders";
import { expiryCutoff, expireOrderIfStale } from "@/lib/order-expiry";

export type CancelOrderState = { ok: boolean; error?: string };

// A signed-in customer may cancel their own order only before the vendor accepts
// it (sent_to_whatsapp / pending) AND while the reservation is still active.
// Owner-scoped, atomic and idempotent: stock is restored exactly once by the 0012
// trigger in the same statement. A past-deadline order is expired authoritatively
// (not cancelled) so a late customer action cannot determine the terminal state.
// Guests cannot cancel (see docs/ORDER-LIFECYCLE.md) — we do not weaken guest security.
export async function cancelOwnOrder(_state: CancelOrderState, formData: FormData): Promise<CancelOrderState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to cancel this order." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Order not found." };

  const { env } = await getCloudflareContext({ async: true });
  const placeholders = CUSTOMER_CANCELLABLE_STATUSES.map(() => "?").join(",");
  const cutoff = expiryCutoff();
  const updated = await env.DB.prepare(
    `UPDATE "Order" SET "status" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND "userId" = ? AND "status" IN (${placeholders}) AND "createdAt" > ? RETURNING "id"`,
  ).bind(ORDER_STATUS_CANCELLED, id, session.user.id, ...CUSTOMER_CANCELLABLE_STATUSES, cutoff).first<{ id: string }>();

  revalidatePath("/account/orders");
  if (!updated) {
    const expiredNow = await expireOrderIfStale(env, id, { userId: session.user.id });
    return { ok: false, error: expiredNow
      ? "This order's reservation window has passed, so it expired and the stock was released."
      : "This order can no longer be cancelled — the seller may have accepted it, or it expired." };
  }
  return { ok: true };
}
