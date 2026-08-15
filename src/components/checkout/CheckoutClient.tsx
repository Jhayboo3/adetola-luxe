"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { useCart } from "@/store/cart";
import { formatPrice } from "@/lib/utils";

type Profile = { name: string; email: string; phone: string; whatsapp: string; gender: string; address: string; city: string; state: string; zip: string; deliveryInfo: string };

export default function CheckoutClient({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { items, getTotal, clearCart } = useCart();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const checkoutToken = useRef(crypto.randomUUID());

  const handleSubmit = async () => {
    setError(""); setSubmitted(true);
    const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutToken: checkoutToken.current, items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, size: item.size, color: item.color })) }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not place your order."); setSubmitted(false); return; }
    clearCart(); window.open(data.whatsappUrl, "_blank", "noopener,noreferrer"); router.push(`/order-confirmation/${data.id}`);
  };

  if (!items.length && !submitted) return <div className="py-32 text-center"><h1 className="font-heading text-[24px]">Your cart is empty</h1><Link href="/shop" className="mt-6 inline-block font-body text-[11px] uppercase tracking-[2px] text-primary">Browse the Archive</Link></div>;
  const total = getTotal();
  return <div className="py-10 md:py-16"><div className="mx-auto max-w-[1100px] px-6 sm:px-8"><div className="grid gap-12 md:grid-cols-[1fr_380px]">
    <section><div className="h-[2px] w-12 bg-gold" /><h1 className="mt-4 font-heading text-[26px]">Checkout</h1><p className="mt-2 font-body text-[13px] text-muted">Your saved profile and measurements will be attached to this order.</p>
      <div className="mt-8 rounded-2xl border border-line p-6"><div className="flex items-center justify-between gap-4"><h2 className="font-body text-[11px] font-semibold uppercase tracking-[2px]">Customer & Delivery</h2><Link href="/account/profile" className="font-body text-[11px] text-primary">Edit Profile</Link></div><div className="mt-5 space-y-2 font-body text-[13px] text-muted"><p className="font-semibold text-black">{profile.name}</p><p>{profile.email} · {profile.phone}</p><p>WhatsApp: {profile.whatsapp} · Gender: {profile.gender}</p><p>{profile.address}, {profile.city}, {profile.state}{profile.zip ? `, ${profile.zip}` : ""}</p>{profile.deliveryInfo && <p>{profile.deliveryInfo}</p>}</div></div>
      {error && <div className="mt-6 border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700"><p>{error}</p>{error.toLowerCase().includes("profile") || error.toLowerCase().includes("measurement") ? <Link href="/account/profile" className="mt-3 inline-block font-semibold underline">Complete Measurements</Link> : null}</div>}
      <div className="mt-8"><Button type="button" fullWidth disabled={submitted} onClick={handleSubmit}>{submitted ? "Preparing WhatsApp..." : "Order via WhatsApp"}</Button><p className="mt-3 text-center font-body text-[10px] uppercase tracking-[2px] text-muted">Stock is checked securely when your order is saved</p></div>
    </section>
    <aside className="md:sticky md:top-28 md:self-start"><div className="border border-line p-6 sm:p-8"><h2 className="font-body text-[11px] font-semibold uppercase tracking-[2px]">Order Summary</h2><div className="mt-6 space-y-4">{items.map((item) => <div key={item.id} className="flex gap-3"><div className="min-w-0 flex-1"><p className="font-heading text-[13px]">{item.name}</p><p className="font-body text-[10px] text-muted">{item.size} · {item.color} × {item.quantity}</p></div><p className="font-body text-[12px]">{formatPrice(item.price * item.quantity)}</p></div>)}</div><div className="mt-6 flex justify-between border-t border-line pt-4 font-heading"><span>Total</span><span>{formatPrice(total)}</span></div></div></aside>
  </div></div></div>;
}
