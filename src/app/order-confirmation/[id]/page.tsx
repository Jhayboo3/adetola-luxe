import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { defaultStore } from "@/lib/store";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await defaultStore();
  const order = await prisma.order.findFirst({ where: { storeId: store.id, OR: [{ orderCode: id.toUpperCase() }, { id }] }, include: { items: { include: { product: true } } } });
  if (!order) notFound();

  return (
    <div className="flex flex-1 items-center justify-center py-32">
      <div className="mx-auto max-w-[600px] px-8 text-center">
        <div className="mx-auto mb-8 h-[2px] w-16 bg-gold" />

        <h1 className="font-heading text-[28px] font-light text-black">
          Thank you
        </h1>

        <p className="mt-4 font-body text-[11px] font-medium uppercase tracking-[2px] text-primary">
          Order #{order.orderCode ?? order.id}
        </p>

        <p className="mt-6 font-serif text-[18px] leading-relaxed text-muted">
          Your order has been saved. Send the prepared WhatsApp message to confirm your order and arrange payment.
        </p>

        <div className="mt-10 border border-line p-8 text-left">
          <h3 className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black">Order summary</h3>
          <div className="mt-4 space-y-3 font-body text-[13px] text-muted">{order.items.map((item) => <div key={item.id} className="flex justify-between gap-4"><span>{item.product.name} ({item.size}, {item.color}) × {item.quantity}</span><span>{formatPrice(item.price * item.quantity)}</span></div>)}<div className="flex justify-between border-t border-line pt-3 font-medium text-black"><span>Total</span><span>{formatPrice(order.total)}</span></div></div>
        </div>

        <div className="mt-10">
          <Link
            href="/shop"
            className="cta-primary"
          >
            Continue Exploring
          </Link>
        </div>
      </div>
    </div>
  );
}
