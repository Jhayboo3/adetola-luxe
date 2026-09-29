import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { storeWhatsappFromRecord, vendorHasContact } from "@/lib/store";
import { addKobo, koboToNaira } from "@/lib/money";
import { orderReference, whatsappOrderUrl } from "@/lib/whatsapp";
import { buyerOrderStatusLabel } from "@/lib/orders";
import WhatsAppHandoff from "@/components/order/WhatsAppHandoff";
import { auth } from "@/auth";
import { sha256 } from "@/lib/checkout-idempotency";

const ORDER_INCLUDE = {
  items: { include: { product: true } },
  store: {
    select: {
      name: true,
      whatsapp: true,
      phone: true,
      owner: { select: { whatsapp: true, phone: true } },
    },
  },
} as const;

async function legacyOrders(ids: string) {
  const terms = ids.split(",").map((s) => s.trim()).filter(Boolean);
  // Older receipts used order IDs as bearer links. Never resolve short codes.
  if (terms.length === 0 || terms.length > 20 || terms.some((term) => !/^c[a-z0-9]{20,32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term))) notFound();
  const orders = await prisma.order.findMany({ where: { id: { in: terms } }, include: ORDER_INCLUDE });
  if (orders.length !== terms.length || new Set(terms).size !== terms.length) notFound();
  return orders;
}

export default async function OrderConfirmationPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ids?: string; token?: string }>;
}) {
  const [{ id }, { ids, token }] = await Promise.all([params, searchParams]);
  let orders: Awaited<ReturnType<typeof legacyOrders>>;
  let checkoutReference: string | null = null;
  let guestToken: string | null = null;
  if (id === "ok") {
    orders = await legacyOrders(ids ?? "");
  } else {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();
    const session = await auth();
    const owned = session?.user?.id ? await prisma.checkout.findFirst({
      where: { id, userId: session.user.id }, include: { orders: { include: ORDER_INCLUDE } },
    }) : null;
    const bearer = !owned && token && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)
      ? await prisma.checkout.findFirst({ where: { id, tokenHash: await sha256(token) }, include: { orders: { include: ORDER_INCLUDE } } })
      : null;
    const checkout = owned ?? bearer;
    if (!checkout || !checkout.orders.length) notFound();
    orders = checkout.orders;
    checkoutReference = checkout.id;
    guestToken = owned ? null : token ?? null;
  }
  const total = orders.every((order) => order.totalMinor != null)
    ? koboToNaira(orders.reduce((sum, order) => addKobo(sum, Number(order.totalMinor)), 0))
    : orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="mx-auto max-w-[620px] px-8 text-center">
        <div className="mx-auto mb-8 h-[2px] w-16 bg-gold" />

        <h1 className="font-heading text-[28px] font-light text-black">
          Thank you
        </h1>

        <p className="mt-4 font-body text-[11px] font-medium uppercase tracking-[2px] text-primary">
          Order{orders.length > 1 ? "s" : ""} {orders.map((o) => orderReference(o.orderCode)).join(", ")}
        </p>
        {checkoutReference && <p className="mt-2 font-body text-[12px] text-muted">Checkout reference: {checkoutReference.slice(0, 8).toUpperCase()}</p>}

        <p className="mt-6 font-serif text-[18px] leading-relaxed text-muted">
          Your {orders.length > 1 ? "orders have" : "order has"} been saved on Larkvine. Larkvine does not process payment. Contact each seller below on WhatsApp to arrange payment and delivery directly with them.
        </p>

        <div className="mt-10 space-y-6 text-left">
          {orders.map((order) => {
            const message = order.notes || `New Larkvine order ${orderReference(order.orderCode)}.`;
            const href = vendorHasContact(order.store) ? whatsappOrderUrl(storeWhatsappFromRecord(order.store), message) : null;
            return (
              <div key={order.id} className="border border-line p-8">
                <div className="flex items-center justify-between">
                  <h3 className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black">{order.store.name}</h3>
                  <span className="font-body text-[11px] text-muted">{orderReference(order.orderCode)}</span>
                </div>
                <p className="mt-2 font-body text-[12px] text-muted">Order created · {buyerOrderStatusLabel(order.status)} · Payment and delivery arranged with the seller</p>
                <div className="mt-4 space-y-3 font-body text-[13px] text-muted">{order.items.map((item) => <div key={item.id} className="flex justify-between gap-4"><span>{item.product.name} ({item.size}, {item.color}) × {item.quantity}</span><span>{formatPrice(item.priceMinor == null ? item.price * item.quantity : koboToNaira(Number(item.priceMinor) * item.quantity))}</span></div>)}<div className="flex justify-between border-t border-line pt-3 font-medium text-black"><span>Total</span><span>{formatPrice(order.totalMinor == null ? order.total : koboToNaira(Number(order.totalMinor)))}</span></div></div>
                <p className="mt-4 font-body text-[12px] text-muted">Delivery: {order.address}, {order.city}, {order.state}</p>
                {href ? <WhatsAppHandoff
                  href={href}
                  orderId={order.id}
                  token={guestToken}
                  className="cta-primary mt-5 w-full"
                >
                  Continue with {order.store.name} on WhatsApp
                </WhatsAppHandoff> : <p className="mt-5 font-body text-[12px] text-red-700">This seller has no WhatsApp contact on file. <Link href="/contact" className="underline">Contact Larkvine support</Link> with your order reference {orderReference(order.orderCode)}.</p>}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-between border border-line p-6 font-heading text-[18px]"><span>Items total</span><span>{formatPrice(total)}</span></div>
        <p className="mt-2 text-left font-body text-[12px] text-muted">Any delivery charge is arranged with each seller before payment.</p>

        <div className="mt-10">
          <Link href="/shop" className="cta-primary">Continue Exploring</Link>
        </div>
      </div>
    </div>
  );
}
