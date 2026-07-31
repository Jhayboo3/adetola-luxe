import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { updateOrder } from "./actions";

export const dynamic = "force-dynamic";
const statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? "";
  const orders = await prisma.order.findMany({ where: q ? { OR: [{ orderCode: { contains: q.toUpperCase() } }, { name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : undefined, include: { items: { include: { product: true } } }, orderBy: { createdAt: "desc" } });
  return <div><div className="mb-8"><h1 className="font-heading text-[24px] font-medium">Orders</h1><p className="mt-1 font-body text-[13px] text-muted">Manage WhatsApp customer orders</p></div>
    <form className="mb-6 flex max-w-xl gap-3"><input name="q" defaultValue={q} placeholder="Search order ID, customer, email or phone" className="min-w-0 flex-1 rounded-full border border-line px-5 py-3 font-body text-[13px] outline-none focus:border-primary" /><button className="rounded-full bg-black px-6 py-3 font-body text-[11px] uppercase tracking-[1px] text-white">Search</button>{q && <a href="/admin/orders" className="self-center font-body text-[11px] text-muted">Clear</a>}</form>
    {orders.length === 0 ? <div className="border border-dashed border-line py-16 text-center font-body text-[13px] text-muted">{q ? `No orders found for “${q}”.` : "No orders yet."}</div> : <div className="space-y-4">{orders.map((order) => <article key={order.id} className="border border-line p-6"><div className="flex flex-wrap justify-between gap-4"><div><p className="font-heading text-[15px]">#{order.orderCode ?? order.id}</p><p className="font-body text-[13px] text-muted">{order.name} · {order.phone || order.email}</p><p className="mt-1 font-body text-[12px] text-muted">{order.address}, {order.city}, {order.state} {order.zip}</p></div><div className="text-right"><p className="font-heading text-[16px] text-gold">{formatPrice(order.total)}</p><p className="font-body text-[11px] text-muted">{order.createdAt.toLocaleString("en-NG")}</p></div></div>
      <div className="mt-4 border-t border-line pt-4 font-body text-[12px] text-muted">{order.items.map((item) => <p key={item.id}>{item.product.name} · {item.size} · {item.color} × {item.quantity} — {formatPrice(item.price * item.quantity)}</p>)}</div>
      <form action={updateOrder} className="mt-4 flex flex-wrap items-end gap-3"><input type="hidden" name="id" value={order.id} /><label className="font-body text-[11px] text-muted">Order status<select name="status" defaultValue={order.status} className="ml-2 border border-line bg-white p-2">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="font-body text-[11px] text-muted">Payment<select name="paymentStatus" defaultValue={order.paymentStatus} className="ml-2 border border-line bg-white p-2"><option value="pending">pending</option><option value="paid">paid</option></select></label><button className="bg-black px-4 py-2 font-body text-[11px] uppercase tracking-[1px] text-white">Update</button></form>
    </article>)}</div>}
  </div>;
}
