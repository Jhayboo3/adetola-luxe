"use client";

import Link from "next/link";
import { useCart } from "@/store/cart";
import { useToast } from "@/store/toast";
import { formatPrice } from "@/lib/utils";
import Image from "next/image";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotal } = useCart();
  const toast = useToast((state) => state.show);

  const handleRemove = (item: { id: string; name: string }) => {
    removeItem(item.id);
    toast(`Removed ${item.name} from your cart.`, "info", "Removed from cart");
  };
  const handleQuantity = (id: string, quantity: number, max?: number) => {
    if (max && quantity > max) quantity = max;
    updateQuantity(id, quantity);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 text-gold">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14l-1 12H6L5 7Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
          </div>
          <h1 className="font-heading text-[24px] font-medium text-black">
            Your cart is empty
          </h1>
          <p className="mt-3 font-body text-[13px] text-muted">
            Explore products from independent stores.
          </p>
          <Link
            href="/shop"
            className="cta-primary mt-8"
          >
            Browse marketplace
          </Link>
        </div>
      </div>
    );
  }

  const total = getTotal();
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.storeSlug || item.storeName || "seller";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-4 h-[2px] w-12 bg-gold" />
        <h1 className="font-heading text-[28px] font-medium text-black">
          Cart
        </h1>
        <p className="mt-2 font-body text-[13px] text-muted">Products are grouped by seller. Each seller handles its part of your order and confirms delivery before payment.</p>

        <div className="mt-12 grid grid-cols-1 gap-16 md:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-8">
            {[...groups.entries()].map(([storeKey, storeItems]) => <section key={storeKey} aria-label={`Products from ${storeItems[0].storeName || "seller"}`} className="border border-line p-4 sm:p-6">
              <h2 className="mb-5 font-heading text-[17px]">{storeItems[0].storeName || "Seller"}</h2>
              <div className="space-y-6">{storeItems.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 border-b border-line pb-6 last:border-b-0 last:pb-0 sm:gap-6"
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
                    {item.storeName && item.storeSlug && <Link href={`/${item.storeSlug}`} className="mt-1 inline-block font-body text-[11px] font-medium text-primary no-underline">Visit seller</Link>}
                    <p className="mt-1 font-body text-[11px] text-muted">
                      Size: {item.size} · Color: {item.color}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleQuantity(item.id, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="flex h-11 w-11 items-center justify-center border border-line font-body text-[13px] transition-colors hover:border-black active:scale-95"
                      >
                        -
                      </button>
                      <span key={`${item.id}-${item.quantity}`} className="inline-block min-w-6 text-center font-body text-[13px] animate-pop">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantity(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="flex h-11 w-11 items-center justify-center border border-line font-body text-[13px] transition-colors hover:border-black active:scale-95"
                      >
                        +
                      </button>
                    </div>
                    <button type="button"
                      onClick={() => handleRemove(item)}
                      className="min-h-11 font-body text-[11px] uppercase tracking-[1px] text-muted transition-colors hover:text-primary"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}</div>
            </section>)}
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
                    Arranged with each store
                  </span>
                </div>
                <div className="border-t border-line pt-4">
                  <div className="flex justify-between font-heading text-[16px] font-medium">
                    <span>Items subtotal</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  <p className="mt-2 font-body text-[11px] text-muted">Delivery charges, if any, are agreed with each store before payment.</p>
                </div>
              </div>

              <Link href="/checkout" className="cta-primary mt-8 w-full">Continue to checkout</Link>

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
