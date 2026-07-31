import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [revenue, orderCount, productCount, lowStock, recent] = await Promise.all([
    prisma.order.aggregate({ where: { status: { not: "cancelled" } }, _sum: { total: true } }),
    prisma.order.count(), prisma.product.count(), prisma.product.count({ where: { stock: { lte: 3 }, published: true } }),
    prisma.order.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
  ]);
  const stats = [{ label: "Order Revenue", value: formatPrice(revenue._sum.total ?? 0) }, { label: "Orders", value: String(orderCount) }, { label: "Products", value: String(productCount) }, { label: "Low Stock", value: String(lowStock) }];
  return <div><div className="mb-8"><h1 className="font-heading text-[24px] font-medium">Dashboard</h1><p className="mt-1 font-body text-[13px] text-muted">Live overview of your archive</p></div><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{stats.map((stat) => <div key={stat.label} className="border border-line p-6"><p className="font-body text-[11px] uppercase tracking-[2px] text-muted">{stat.label}</p><p className="mt-2 font-heading text-[24px]">{stat.value}</p></div>)}</div>
    <div className="mt-10 flex items-center justify-between"><h2 className="font-heading text-[18px]">Recent Orders</h2><Link href="/admin/orders" className="font-body text-[11px] uppercase tracking-[2px] text-primary no-underline">View all</Link></div><div className="mt-4 border border-line">{recent.length ? recent.map((order) => <div key={order.id} className="flex justify-between gap-4 border-b border-line p-4 last:border-0"><div><p className="font-heading text-[13px]">{order.name}</p><p className="font-body text-[11px] text-muted">#{order.orderCode ?? order.id} · {order.status}</p></div><p className="font-body text-[13px]">{formatPrice(order.total)}</p></div>) : <p className="p-8 text-center font-body text-[13px] text-muted">No orders yet.</p>}</div></div>;
}
