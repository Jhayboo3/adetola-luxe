"use client";

import Link from "next/link";
import { useCart } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Image from "next/image";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <div className="text-center">
          <div className="mx-auto mb-6 h-[2px] w-16 bg-gold" />
          <h1 className="font-heading text-[24px] font-medium text-black">
            Your archive is empty
          </h1>
          <p className="mt-3 font-body text-[13px] text-muted">
            Begin collecting pieces that speak to you.
          </p>
          <Link
            href="/shop"
            className="cta-primary mt-8"
          >
            Browse the Archive
          </Link>
        </div>
      </div>
    );
  }

  const total = getTotal();

  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-4 h-[2px] w-12 bg-gold" />
        <h1 className="font-heading text-[28px] font-medium text-black">
          Cart
        </h1>

        <div className="mt-12 grid grid-cols-1 gap-16 md:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-8">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-6 border-b border-line pb-8"
              >
                <div className="relative aspect-[3/4] w-20 flex-shrink-0 overflow-hidden rounded-xl bg-line md:w-28">
                  {item.image ? <Image src={item.image} alt={item.name} fill sizes="112px" className="object-cover" unoptimized /> : <div className="flex h-full w-full items-center justify-center bg-[#E5DDD3]"><span className="font-body text-[9px] text-muted">Image</span></div>}
                </div>

                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <div className="flex justify-between">
                      <h3 className="font-heading text-[16px] font-medium text-black">
                        {item.name}
                      </h3>
                      <p className="font-body text-[13px] text-muted">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                    <p className="font-body text-[11px] text-muted">
                      Size: {item.size} · Color: {item.color}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="flex h-8 w-8 items-center justify-center border border-line font-body text-[13px] transition-colors hover:border-black"
                      >
                        -
                      </button>
                      <span className="font-body text-[13px]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="flex h-8 w-8 items-center justify-center border border-line font-body text-[13px] transition-colors hover:border-black"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="font-body text-[11px] uppercase tracking-[2px] text-muted transition-colors hover:text-primary"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="md:sticky md:top-8 md:self-start">
            <div className="border border-line p-8">
              <h3 className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black">
                Order Summary
              </h3>

              <div className="mt-6 space-y-4">
                <div className="flex justify-between font-body text-[13px]">
                  <span className="text-muted">Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between font-body text-[13px]">
                  <span className="text-muted">Shipping</span>
                  <span className="text-primary">
                    {total >= 100000 ? "Complimentary" : "Calculated at checkout"}
                  </span>
                </div>
                <div className="border-t border-line pt-4">
                  <div className="flex justify-between font-heading text-[16px] font-medium">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
              </div>

              <Link href="/checkout" className="mt-8 block">
                <Button fullWidth>Checkout</Button>
              </Link>

              <Link
                href="/shop"
                className="cta-secondary mt-4 w-full"
              >
                Continue Browsing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
