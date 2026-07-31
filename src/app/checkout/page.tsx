"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useCart } from "@/store/cart";
import { formatPrice } from "@/lib/utils";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotal, clearCart } = useCart();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitted(true);
    const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, size: item.size, color: item.color })) }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not place your order."); setSubmitted(false); return; }
    clearCart();
    window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
    router.push(`/order-confirmation/${data.id}`);
  };

  if (items.length === 0 && !submitted) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <div className="text-center">
          <h1 className="font-heading text-[24px] font-medium text-black">
            Your cart is empty
          </h1>
          <Link
            href="/shop"
            className="mt-6 inline-block font-body text-[11px] uppercase tracking-[2px] text-primary no-underline"
          >
            Browse the Archive
          </Link>
        </div>
      </div>
    );
  }

  const total = getTotal();

  return (
    <div className="py-10 md:py-16">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-8">
          <Link
            href="/"
            className="font-heading text-xl tracking-tight text-black no-underline"
          >
            Adetola Luxe
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-16 md:grid-cols-[1fr_380px]">
          <form onSubmit={handleSubmit}>
            <div className="mb-4 h-[2px] w-12 bg-gold" />
            <h1 className="font-heading text-[24px] font-medium text-black">
              Checkout
            </h1>

            <div className="mt-10 space-y-6">
              <p className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black">
                Contact
              </p>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                required
              />
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={handleChange}
              />
            </div>

            <div className="mt-10 space-y-6">
              <p className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black">
                Shipping
              </p>
              <Input
                id="name"
                name="name"
                placeholder="Full Name"
                value={form.name}
                onChange={handleChange}
                required
              />
              <Input
                id="address"
                name="address"
                placeholder="Address"
                value={form.address}
                onChange={handleChange}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="city"
                  name="city"
                  placeholder="City"
                  value={form.city}
                  onChange={handleChange}
                  required
                />
                <Input
                  id="state"
                  name="state"
                  placeholder="State"
                  value={form.state}
                  onChange={handleChange}
                  required
                />
              </div>
              <Input
                id="zip"
                name="zip"
                placeholder="Postal Code"
                value={form.zip}
                onChange={handleChange}
                required
              />
            </div>

            <div className="mt-10 space-y-6">
              <p className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black">
                Payment
              </p>
              <p className="font-body text-[13px] text-muted">After saving your order, WhatsApp will open with your name, address, items, prices, and total ready to send to Adetola Luxe.</p>
            </div>

            <div className="mt-10">
              {error && <p className="mb-4 border border-red-200 bg-red-50 p-3 font-body text-[13px] text-red-700">{error}</p>}
              <Button
                type="submit"
                fullWidth
                disabled={submitted}
              >
                {submitted ? "Preparing WhatsApp..." : "Order via WhatsApp"}
              </Button>
              <p className="mt-3 text-center font-body text-[11px] uppercase tracking-[2px] text-muted">
                Your order is saved before WhatsApp opens
              </p>
            </div>
          </form>

          <div className="md:sticky md:top-8 md:self-start">
            <div className="border border-line p-8">
              <h3 className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black">
                Order Summary
              </h3>

              <div className="mt-6 space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="h-16 w-12 flex-shrink-0 bg-line" />
                    <div className="flex-1">
                      <p className="font-heading text-[13px] font-medium text-black">
                        {item.name}
                      </p>
                      <p className="font-body text-[11px] text-muted">
                        Size: {item.size} · Color: {item.color} &times; {item.quantity}
                      </p>
                    </div>
                    <p className="font-body text-[13px] text-muted">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3 border-t border-line pt-4">
                <div className="flex justify-between font-body text-[13px]">
                  <span className="text-muted">Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between font-heading text-[16px] font-medium">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
