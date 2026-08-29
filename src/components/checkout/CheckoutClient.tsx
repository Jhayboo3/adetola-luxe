"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { useCart } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import { GARMENT_SIZES } from "@/lib/measurements";

type Profile = { name: string; email: string; phone: string; whatsapp: string; gender: string; address: string; city: string; state: string; zip: string; deliveryInfo: string };

export default function CheckoutClient({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { items, getTotal, clearCart } = useCart();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [size, setSize] = useState("");
  const checkoutToken = useRef(crypto.randomUUID());
  const formRef = useRef<HTMLFormElement>(null);

  const inputClass = "h-[46px] w-full border-b border-black bg-transparent px-1 font-body text-[14px] outline-none focus:border-gold";

  const handleSubmit = async () => {
    if (!formRef.current?.reportValidity()) return;
    setError(""); setSubmitted(true);
    const form = new FormData(formRef.current!);
    const customer = {
      name: String(form.get("name") || ""), email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""), whatsapp: String(form.get("whatsapp") || ""),
      gender: String(form.get("gender") || ""), address: String(form.get("address") || ""),
      city: String(form.get("city") || ""), state: String(form.get("state") || ""),
      zip: String(form.get("zip") || ""), deliveryInfo: String(form.get("deliveryInfo") || ""),
      size,
    };
    const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutToken: checkoutToken.current, items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, size: item.size, color: item.color })), customer }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not place your order."); setSubmitted(false); return; }
    clearCart(); window.open(data.whatsappUrl, "_blank", "noopener,noreferrer"); router.push(`/order-confirmation/${data.id}`);
  };

  if (!items.length && !submitted) return <div className="py-32 text-center"><h1 className="font-heading text-[24px]">Your cart is empty</h1><Link href="/shop" className="mt-6 inline-block font-body text-[11px] uppercase tracking-[2px] text-primary">Browse the Archive</Link></div>;
  const total = getTotal();
  return <div className="py-10 md:py-16"><div className="mx-auto max-w-[1100px] px-6 sm:px-8"><div className="grid gap-12 md:grid-cols-[1fr_380px]">
    <section><div className="h-[2px] w-12 bg-gold" /><h1 className="mt-4 font-heading text-[26px]">Checkout</h1><p className="mt-2 font-body text-[13px] text-muted">Enter your contact and delivery details, then choose your garment size. You don&apos;t need an account.</p>
      <form ref={formRef} className="mt-8 space-y-10">
        <section className="rounded-2xl border border-line p-6">
          <h2 className="font-body text-[11px] font-semibold uppercase tracking-[2px]">Contact Information</h2>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <label className="font-body text-[12px] text-muted">Full Name *<input className={inputClass} name="name" defaultValue={profile.name} required /></label>
            <label className="font-body text-[12px] text-muted">Email Address *<input className={inputClass} name="email" type="email" defaultValue={profile.email} required /></label>
            <label className="font-body text-[12px] text-muted">Phone Number *<input className={inputClass} name="phone" type="tel" defaultValue={profile.phone} required /></label>
            <label className="font-body text-[12px] text-muted">WhatsApp Number *<input className={inputClass} name="whatsapp" type="tel" defaultValue={profile.whatsapp} required /></label>
            <label className="font-body text-[12px] text-muted">Gender<select className={inputClass} name="gender" defaultValue={profile.gender || ""}><option value="">Prefer not to say</option><option value="Male">Male</option><option value="Female">Female</option></select></label>
          </div>
        </section>
        <section className="rounded-2xl border border-line p-6">
          <h2 className="font-body text-[11px] font-semibold uppercase tracking-[2px]">Delivery Information</h2>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <label className="font-body text-[12px] text-muted md:col-span-2">Delivery Address *<input className={inputClass} name="address" defaultValue={profile.address} required /></label>
            <label className="font-body text-[12px] text-muted">State *<input className={inputClass} name="state" defaultValue={profile.state} required /></label>
            <label className="font-body text-[12px] text-muted">City *<input className={inputClass} name="city" defaultValue={profile.city} required /></label>
            <label className="font-body text-[12px] text-muted">Postal Code<input className={inputClass} name="zip" defaultValue={profile.zip} /></label>
            <label className="font-body text-[12px] text-muted md:col-span-2">Additional Delivery Information<textarea className="mt-2 min-h-20 w-full border border-line p-3 font-body text-[14px] outline-none focus:border-gold" name="deliveryInfo" defaultValue={profile.deliveryInfo} /></label>
          </div>
        </section>
        <section className="rounded-2xl border border-line p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-body text-[11px] font-semibold uppercase tracking-[2px]">Your Garment Size</h2><p className="mt-1 font-body text-[12px] text-muted">Choose one size from our standard range.</p></div></div>
          <div className="mt-5 flex flex-wrap gap-3">{GARMENT_SIZES.map((s) => <button key={s} type="button" onClick={() => setSize(s)} aria-pressed={size === s} className={`min-h-12 min-w-[68px] rounded-full border px-6 font-body text-[12px] font-bold uppercase tracking-[1.2px] transition-all ${size === s ? "border-gold bg-gold text-black" : "border-line text-muted hover:border-black"}`}>{s}</button>)}</div>
          {!size && <p className="mt-3 font-body text-[11px] text-red-600">Please select your garment size.</p>}
        </section>
      </form>
      {error && <div className="mt-6 border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700"><p>{error}</p>{error.toLowerCase().includes("size") ? <p className="mt-2 text-[11px]">Choose a garment size from L, M, XL, XXL, XXXL.</p> : null}</div>}
      <div className="mt-8"><Button type="button" fullWidth disabled={submitted || !size} onClick={handleSubmit}>{submitted ? "Preparing WhatsApp..." : "Order via WhatsApp"}</Button><p className="mt-3 text-center font-body text-[10px] uppercase tracking-[2px] text-muted">Stock is checked securely when your order is saved</p></div>
    </section>
    <aside className="md:sticky md:top-28 md:self-start"><div className="border border-line p-6 sm:p-8"><h2 className="font-body text-[11px] font-semibold uppercase tracking-[2px]">Order Summary</h2><div className="mt-6 space-y-4">{items.map((item) => <div key={item.id} className="flex gap-3"><div className="min-w-0 flex-1"><p className="font-heading text-[13px]">{item.name}</p><p className="font-body text-[10px] text-muted">{item.size} · {item.color} × {item.quantity}</p></div><p className="font-body text-[12px]">{formatPrice(item.price * item.quantity)}</p></div>)}</div><div className="mt-6 flex justify-between border-t border-line pt-4 font-heading"><span>Total</span><span>{formatPrice(total)}</span></div></div></aside>
  </div></div></div>;
}
