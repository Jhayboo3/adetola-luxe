import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addKobo, koboToNaira } from "@/lib/money";
import { buyerOrderStatusLabel, canCustomerCancelOrder, rejectionReasonLabel } from "@/lib/orders";
import { storeWhatsappFromRecord, vendorHasContact } from "@/lib/store";
import { orderReference, whatsappOrderUrl } from "@/lib/whatsapp";
import { runOpportunisticExpirySweep } from "@/lib/order-expiry";
import { formatPrice } from "@/lib/utils";
import CancelOrderButton from "./cancel-button";
import WhatsAppHandoff from "@/components/order/WhatsAppHandoff";

const PAGE_SIZE = 20;
const STORE_CONTACT = { select: { name: true, slug: true, whatsapp: true, phone: true, owner: { select: { whatsapp: true, phone: true } } } } as const;
const ITEM_SELECT = { include: { product: { select: { name: true, slug: true } } } } as const;

type ContactStore = Parameters<typeof vendorHasContact>[0];
function continueHref(order: { status: string; notes: string | null; orderCode: string | null; store: ContactStore }): string | null {
  if (order.status === "cancelled" || order.status === "expired" || !vendorHasContact(order.store)) return null;
  return whatsappOrderUrl(storeWhatsappFromRecord(order.store), order.notes || `New Larkvine order ${orderReference(order.orderCode)}.`);
}

function pageNumber(value?: string) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, 10000) : 1;
}

function paymentLabel(status: string) {
  return status === "paid" ? "Vendor marked payment received" : "Awaiting vendor payment update";
}

export default async function CustomerOrdersPage({ searchParams }: {
  searchParams: Promise<{ page?: string; olderPage?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/orders");
  const userId = session.user.id;
  const params = await searchParams;
  const page = pageNumber(params.page);
  const olderPage = pageNumber(params.olderPage);

  // Opportunistic, throttled release of stale unaccepted orders (see order-expiry).
  await runOpportunisticExpirySweep();

  // Both queries are scoped by the authenticated user, including legacy orders
  // created before the Checkout parent existed. No public order code is used.
  const [checkouts, olderOrders] = await Promise.all([
    prisma.checkout.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: { orders: { include: { store: STORE_CONTACT, items: ITEM_SELECT } } },
    }),
    prisma.order.findMany({
      where: { userId, checkoutId: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (olderPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: { store: STORE_CONTACT, items: ITEM_SELECT },
    }),
  ]);
  const hasMore = checkouts.length > PAGE_SIZE;
  const hasMoreOlder = olderOrders.length > PAGE_SIZE;

  return <div className="mx-auto w-full max-w-[1000px] px-5 py-12 sm:px-8 md:py-16">
    <div className="h-[2px] w-12 bg-gold" />
    <h1 className="mt-4 font-heading text-[28px] font-medium">My Orders</h1>
    <p className="mt-2 font-body text-[13px] text-muted">Each store handles its part of a marketplace checkout. Payment and delivery are arranged directly with the store.</p>

    <section className="mt-10 space-y-6" aria-label="Recent checkouts">
      {checkouts.slice(0, PAGE_SIZE).map((checkout) => {
        const total = checkout.orders.every((order) => order.totalMinor != null)
          ? koboToNaira(checkout.orders.reduce((sum, order) => addKobo(sum, Number(order.totalMinor)), 0))
          : checkout.orders.reduce((sum, order) => sum + order.total, 0);
        return <article key={checkout.id} className="border border-line bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-heading text-[18px]">Checkout #{checkout.id.slice(0, 8).toUpperCase()}</h2><p className="mt-1 font-body text-[11px] text-muted">{checkout.createdAt.toLocaleString("en-NG")} · {checkout.orders.length} {checkout.orders.length === 1 ? "store" : "stores"}</p></div>
            <p className="font-heading text-[18px]">{formatPrice(total)}</p>
          </div>
          <div className="mt-5 space-y-4">{checkout.orders.map((order) => {
            const href = continueHref(order);
            const reason = rejectionReasonLabel(order.rejectionReason);
            return <div key={order.id} className="border-t border-line pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/${order.store.slug}`} className="font-body text-[13px] font-semibold text-primary">{order.store.name}</Link><span className="font-body text-[11px] text-muted">{orderReference(order.orderCode)} · {buyerOrderStatusLabel(order.status)}</span></div>
              <p className="mt-1 font-body text-[11px] text-muted">{paymentLabel(order.paymentStatus)}</p>
              <p className="mt-2 font-body text-[12px] text-muted">{order.items.map((item) => `${item.product.name} × ${item.quantity}`).join(" · ")}</p>
              <p className="mt-2 font-body text-[12px] font-medium">{formatPrice(order.totalMinor == null ? order.total : koboToNaira(Number(order.totalMinor)))}</p>
              {reason && <p className="mt-1 font-body text-[11px] text-muted">Reason: {reason}</p>}
              {order.status === "expired" && <div className="mt-2 rounded-lg bg-[#F7F2E8] p-3"><p className="font-body text-[11px] text-muted">The reservation expired before the seller accepted the order. You can place a new order if the item is still available.</p>{order.items[0] && <Link href={`/${order.store.slug}/${order.items[0].product.slug}`} className="mt-1 inline-block font-body text-[11px] font-semibold text-primary underline underline-offset-4">Order again</Link>}</div>}
              {href && <WhatsAppHandoff href={href} orderId={order.id} className="mt-2 inline-block font-body text-[12px] font-semibold text-primary underline underline-offset-4">Continue on WhatsApp</WhatsAppHandoff>}
              {canCustomerCancelOrder(order.status) && <CancelOrderButton id={order.id} />}
            </div>;
          })}</div>
          <Link href={`/order-confirmation/${checkout.id}`} className="mt-5 inline-block font-body text-[12px] font-semibold text-primary underline underline-offset-4">View checkout receipt</Link>
        </article>;
      })}
      {!checkouts.length && !olderOrders.length && page === 1 && <div className="border border-dashed border-line p-8"><p className="font-heading text-[18px]">No orders yet</p><p className="mt-2 font-body text-[13px] text-muted">When you place an order, you can track each seller&apos;s part here.</p><Link href="/shop" className="cta-primary mt-5">Browse marketplace</Link></div>}
      <div className="flex gap-5 font-body text-[12px]">{page > 1 && <Link href={`/account/orders?page=${page - 1}&olderPage=${olderPage}`}>Previous checkouts</Link>}{hasMore && <Link href={`/account/orders?page=${page + 1}&olderPage=${olderPage}`}>More checkouts</Link>}</div>
    </section>

    {(olderOrders.length > 0 || olderPage > 1) && <section className="mt-14" aria-label="Earlier orders">
      <h2 className="font-heading text-[20px]">Earlier Orders</h2>
      <p className="mt-1 font-body text-[12px] text-muted">Orders placed before checkout grouping was introduced.</p>
      <div className="mt-5 space-y-4">{olderOrders.slice(0, PAGE_SIZE).map((order) => {
        const href = continueHref(order);
        const reason = rejectionReasonLabel(order.rejectionReason);
        return <article key={order.id} className="border border-line p-5 sm:p-6">
          <div className="flex flex-wrap justify-between gap-2"><div><p className="font-heading text-[16px]">{order.orderCode ? orderReference(order.orderCode) : order.id}</p><p className="mt-1 font-body text-[12px] text-muted">{order.store.name} · {buyerOrderStatusLabel(order.status)} · {paymentLabel(order.paymentStatus)}</p></div><p className="font-heading text-[16px]">{formatPrice(order.total)}</p></div>
          <p className="mt-3 font-body text-[12px] text-muted">{order.items.map((item) => `${item.product.name} × ${item.quantity}`).join(" · ")}</p>
          <p className="mt-2 font-body text-[11px] text-muted">{order.createdAt.toLocaleString("en-NG")}</p>
          {reason && <p className="mt-1 font-body text-[11px] text-muted">Reason: {reason}</p>}
          {order.status === "expired" && <p className="mt-2 font-body text-[11px] text-muted">The reservation expired before the seller accepted the order. You can place a new order if the item is still available.</p>}
          {href && <WhatsAppHandoff href={href} orderId={order.id} className="mt-3 inline-block font-body text-[12px] font-semibold text-primary underline underline-offset-4">Continue on WhatsApp</WhatsAppHandoff>}
          {canCustomerCancelOrder(order.status) && <CancelOrderButton id={order.id} />}
        </article>;
      })}</div>
      <div className="mt-5 flex gap-5 font-body text-[12px]">{olderPage > 1 && <Link href={`/account/orders?page=${page}&olderPage=${olderPage - 1}`}>Previous earlier orders</Link>}{hasMoreOlder && <Link href={`/account/orders?page=${page}&olderPage=${olderPage + 1}`}>More earlier orders</Link>}</div>
    </section>}
  </div>;
}
