import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const codes = (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const orders = await prisma.order.findMany({
    where: { OR: codes.map((code) => ({ orderCode: code.toUpperCase() })) },
    include: { items: { include: { product: true } }, store: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (orders.length === 0 || orders.length !== codes.length) notFound();
  const total = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="mx-auto max-w-[620px] px-8 text-center">
        <div className="mx-auto mb-8 h-[2px] w-16 bg-gold" />

        <h1 className="font-heading text-[28px] font-light text-black">
          Thank you
        </h1>

        <p className="mt-4 font-body text-[11px] font-medium uppercase tracking-[2px] text-primary">
          Order{orders.length > 1 ? "s" : ""} #{orders.map((o) => o.orderCode).join(", #")}
        </p>

        <p className="mt-6 font-serif text-[18px] leading-relaxed text-muted">
          Your {orders.length > 1 ? "orders have" : "order has"} been saved.
          We&apos;ve opened a WhatsApp message to each store so you can confirm and arrange payment.
        </p>

        <div className="mt-10 space-y-6 text-left">
          {orders.map((order) => (
            <div key={order.id} className="border border-line p-8">
              <div className="flex items-center justify-between">
                <h3 className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black">{order.store.name}</h3>
                <span className="font-body text-[11px] text-muted">#{order.orderCode}</span>
              </div>
              <div className="mt-4 space-y-3 font-body text-[13px] text-muted">{order.items.map((item) => <div key={item.id} className="flex justify-between gap-4"><span>{item.product.name} ({item.size}, {item.color}) × {item.quantity}</span><span>{formatPrice(item.price * item.quantity)}</span></div>)}<div className="flex justify-between border-t border-line pt-3 font-medium text-black"><span>Total</span><span>{formatPrice(order.total)}</span></div></div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-between border border-line p-6 font-heading text-[18px]"><span>Marketplace Total</span><span>{formatPrice(total)}</span></div>

        <div className="mt-10">
          <Link href="/shop" className="cta-primary">Continue Exploring</Link>
        </div>
      </div>
    </div>
  );
}
