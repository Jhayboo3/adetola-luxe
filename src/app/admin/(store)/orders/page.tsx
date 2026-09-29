import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { updateOrder } from "./actions";
import VendorOrderActions from "./order-actions";
import CopyMeasurementsButton from "@/components/admin/CopyMeasurementsButton";
import { requireStore } from "@/lib/store";
import { runOpportunisticExpirySweep } from "@/lib/order-expiry";
import { canAcceptOrder, canTransitionOrderStatus, ORDER_STATUSES, ORDER_STATUS_LABELS, orderStatusLabel, rejectionReasonLabel } from "@/lib/orders";

function ageLabel(createdAt: Date): string {
  const hours = Math.floor((Date.now() - createdAt.getTime()) / 3_600_000);
  if (hours < 1) return "under an hour old";
  if (hours < 24) return `${hours}h old`;
  return `${Math.floor(hours / 24)}d old`;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.min(Math.max(Number.parseInt(params.page ?? "1", 10) || 1, 1), 1000);
  const PAGE_SIZE = 25;
  const store = await requireStore();

  // Opportunistic, throttled release of stale unaccepted orders.
  await runOpportunisticExpirySweep();

  const rows = await prisma.order.findMany({ where: { storeId: store.id, ...(q ? { OR: [{ orderCode: { contains: q.toUpperCase() } }, { name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {}) }, include: { items: { include: { product: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1 });
  const hasNext = rows.length > PAGE_SIZE;
  const orders = rows.slice(0, PAGE_SIZE);
  const pageHref = (target: number) => `/admin/orders?${new URLSearchParams({ ...(q ? { q } : {}), page: String(target) }).toString()}`;
  return <div><div className="mb-8"><h1 className="font-heading text-[24px] font-medium">Orders</h1><p className="mt-1 font-body text-[13px] text-muted">Manage WhatsApp customer orders</p></div>
    <form className="mb-6 flex max-w-xl flex-wrap gap-3"><input name="q" defaultValue={q} placeholder="Search order ID, customer, email or phone" className="min-w-0 basis-full rounded-full border border-line px-5 py-3 font-body text-[13px] outline-none focus:border-primary sm:flex-1 sm:basis-auto" /><button className="cta-primary min-h-11 px-6 py-3">Search</button>{q && <Link href="/admin/orders" className="self-center font-body text-[11px] text-muted">Clear</Link>}</form>
    {orders.length === 0 ? <div className="border border-dashed border-line py-16 text-center font-body text-[13px] text-muted">{q ? `No orders found for “${q}”.` : "No orders yet."}</div> : <div className="space-y-4">{orders.map((order) => {
      const statusOptions = ORDER_STATUSES.filter((status) => canTransitionOrderStatus(order.status, status) && status !== "cancelled" && status !== "expired" && !(canAcceptOrder(order.status) && status === "confirmed"));
      const editable = order.status !== "cancelled" && order.status !== "expired";
      const reason = rejectionReasonLabel(order.rejectionReason);
      return <article key={order.id} className="min-w-0 border border-line p-4 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between"><div className="min-w-0"><p className="break-all font-heading text-[15px]">#{order.orderCode ?? order.id}</p><p className="break-words font-body text-[13px] text-muted">{order.name} · {order.phone || order.email}</p><p className="mt-1 break-words font-body text-[12px] text-muted">{order.address}, {order.city}, {order.state} {order.zip}</p></div><div className="sm:text-right"><p className="font-heading text-[16px] text-primary-dark">{formatPrice(order.total)}</p><p className="font-body text-[11px] text-muted">{order.createdAt.toLocaleString("en-NG")} · {ageLabel(order.createdAt)}</p><p className="font-body text-[11px] font-semibold">{orderStatusLabel(order.status)}</p></div></div>
      <div className="mt-4 border-t border-line pt-4 font-body text-[12px] text-muted">{order.items.map((item) => <p key={item.id}>{item.product.name} · {item.size} · {item.color} × {item.quantity} — {formatPrice(item.price * item.quantity)}</p>)}</div>
      <div className="mt-3 space-y-1 font-body text-[11px] text-muted">
        {order.vendorContactOpenedAt && <p>Customer opened WhatsApp {order.vendorContactOpenedAt.toLocaleString("en-NG")}</p>}
        {order.acceptedAt && <p>Accepted {order.acceptedAt.toLocaleString("en-NG")}</p>}
        {reason && <p>Reason: {reason}</p>}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{order.size && <section className="rounded-xl bg-[#F7F2E8] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-body text-[11px] font-semibold uppercase tracking-[2px] text-black">Garment Size</h3><p className="mt-1 font-body text-[12px] text-muted">{order.size}</p></div><CopyMeasurementsButton text={`Order #${order.orderCode ?? order.id}\nCustomer: ${order.name}\nGarment Size: ${order.size}`} /></div></section>}</div>
      <VendorOrderActions id={order.id} status={order.status} />
      {editable ? <form action={updateOrder} className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end"><input type="hidden" name="id" value={order.id} /><label className="flex flex-col gap-1 font-body text-[11px] text-muted">Order status<select name="status" defaultValue={order.status} className="border border-line bg-white p-2">{statusOptions.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}</select></label><label className="flex flex-col gap-1 font-body text-[11px] text-muted">Vendor-reported payment<select name="paymentStatus" defaultValue={order.paymentStatus} className="border border-line bg-white p-2"><option value="pending">pending</option><option value="paid">received</option></select></label><button className="cta-secondary min-h-10 px-4 py-2 text-[10px]">Update</button></form> : <p className="mt-4 font-body text-[12px] text-muted">This order is {orderStatusLabel(order.status).toLowerCase()} and read-only.</p>}
    </article>;
    })}</div>}
    {(page > 1 || hasNext) && <nav aria-label="Order pages" className="mt-8 flex items-center justify-between gap-4 font-body text-[12px]">{page > 1 ? <Link href={pageHref(page - 1)} className="cta-secondary px-5 py-3">Previous</Link> : <span />}<span className="text-muted">Page {page}</span>{hasNext ? <Link href={pageHref(page + 1)} className="cta-secondary px-5 py-3">Next</Link> : <span />}</nav>}
  </div>;
}
