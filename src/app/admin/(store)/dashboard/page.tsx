import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { requireStore } from "@/lib/store";
import { orderStatusLabel, ORDER_STATUSES_EXCLUDED_FROM_REVENUE } from "@/lib/orders";


export default async function AdminDashboardPage() {
  const store = await requireStore();
  const [revenue, orderCount, productCount, lowStock, recent] = await Promise.all([
    prisma.order.aggregate({ where: { storeId: store.id, status: { notIn: [...ORDER_STATUSES_EXCLUDED_FROM_REVENUE] } }, _sum: { total: true } }),
    prisma.order.count({ where: { storeId: store.id } }), prisma.product.count({ where: { storeId: store.id } }), prisma.product.count({ where: { storeId: store.id, stock: { lte: 3 }, published: true } }),
    prisma.order.findMany({ where: { storeId: store.id }, take: 5, orderBy: { createdAt: "desc" } }),
  ]);
  const stats = [{ label: "Order Revenue", value: formatPrice(revenue._sum.total ?? 0) }, { label: "Orders", value: String(orderCount) }, { label: "Products", value: String(productCount) }, { label: "Low Stock", value: String(lowStock) }];
  return <div className="min-w-0"><div className="mb-8"><h1 className="font-heading text-[24px] font-medium">Dashboard</h1><p className="mt-1 font-body text-[13px] text-muted">Live overview of your archive</p></div><div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 md:grid-cols-4">{stats.map((stat) => <div key={stat.label} className="min-w-0 border border-line p-4 sm:p-6"><p className="font-body text-[10px] uppercase tracking-[1.5px] text-muted sm:text-[11px] sm:tracking-[2px]">{stat.label}</p><p className="mt-2 break-words font-heading text-[20px] sm:text-[24px]">{stat.value}</p></div>)}</div>
    <div className="mt-10 flex items-center justify-between"><h2 className="font-heading text-[18px]">Recent Orders</h2><Link href="/admin/orders" className="font-body text-[11px] uppercase tracking-[2px] text-primary no-underline">View all</Link></div><div className="mt-4 border border-line">{recent.length ? recent.map((order) => <div key={order.id} className="flex flex-col gap-2 border-b border-line p-4 last:border-0 sm:flex-row sm:justify-between sm:gap-4"><div className="min-w-0"><p className="font-heading text-[13px]">{order.name}</p><p className="break-all font-body text-[11px] text-muted">#{order.orderCode ?? order.id} · {orderStatusLabel(order.status)}</p></div><p className="shrink-0 font-body text-[13px]">{formatPrice(order.total)}</p></div>) : <p className="p-8 text-center font-body text-[13px] text-muted">No orders yet.</p>}</div></div>;
}
