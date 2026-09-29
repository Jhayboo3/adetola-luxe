import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/checkout-idempotency";

// Records that the customer opened the vendor WhatsApp handoff for one child
// order. This is a handoff event only: it never changes order status, never
// extends the expiry window, and is not payment or acceptance evidence.
//
// Authorization mirrors the confirmation page: the signed-in owner, or a guest
// presenting the opaque checkout bearer token. The WhatsApp recipient is always
// derived server-side elsewhere; the client never supplies it here.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  let token: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.token === "string") token = body.token;
  } catch {
    token = null;
  }

  const session = await auth();
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, userId: true, checkoutId: true } });
  if (!order) return Response.json({ ok: false }, { status: 404 });

  let authorized = Boolean(session?.user?.id && order.userId === session.user.id);
  if (!authorized && token && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token) && order.checkoutId) {
    const checkout = await prisma.checkout.findFirst({ where: { id: order.checkoutId, tokenHash: await sha256(token) }, select: { id: true } });
    authorized = Boolean(checkout);
  }
  if (!authorized) return Response.json({ ok: false }, { status: 403 });

  const { env } = await getCloudflareContext({ async: true });
  await env.DB
    .prepare('UPDATE "Order" SET "vendorContactOpenedAt" = ? WHERE "id" = ? AND "vendorContactOpenedAt" IS NULL')
    .bind(new Date().toISOString(), id)
    .run();

  return Response.json({ ok: true });
}
