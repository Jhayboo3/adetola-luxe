"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function SellPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", storeName: "", whatsapp: "", phone: "", description: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/vendor-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }
    setLoading(false);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return (
      <div className="py-16 md:py-24">
        <div className="mx-auto max-w-2xl px-8">
          <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#005C29]/10">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#005C29" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="mt-6 font-heading text-[24px] font-medium text-black">Application submitted successfully.</h1>
            <p className="mx-auto mt-3 max-w-md font-body text-[14px] leading-relaxed text-muted">
              Your store application is currently under review. You will be notified once an administrator approves your store. You&apos;ll then be able to sign in to your store dashboard, upload products, and start selling on Larkvine.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/">
                <Button type="button">Back to Marketplace</Button>
              </Link>
              <Link href="/login">
                <Button type="button" variant="outline">Sign in</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-2xl px-8">
        <div className="mb-4 h-[2px] w-12 bg-gold" />
        <h1 className="font-heading text-[28px] font-medium text-black">Open your store on Larkvine</h1>
        <p className="mt-3 font-body text-[13px] text-muted">
          Apply to become a seller, list your products, and receive order notifications directly on your own WhatsApp number. Applications are reviewed by our team before your store goes live.
        </p>

        {error && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <section className="rounded-2xl border border-line p-6">
            <h2 className="font-body text-[11px] font-semibold uppercase tracking-[2px]">Your Store</h2>
            <div className="mt-5 space-y-5">
              <Input id="storeName" type="text" label="Store Name" placeholder="e.g. Trendy Closet" value={form.storeName} onChange={set("storeName")} required />
              <div>
                <label htmlFor="description" className="font-body text-[12px] font-medium text-black">
                  Store Description <span className="text-muted">(optional)</span>
                </label>
                <textarea
                  id="description"
                  rows={3}
                  placeholder="Tell shoppers a little about your store and what you sell…"
                  value={form.description}
                  onChange={set("description")}
                  className="mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 font-body text-[13px] text-black outline-none transition focus:border-[#005C29]"
                />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Input id="whatsapp" type="tel" label="Store WhatsApp Number" placeholder="e.g. 2348000001234 (international, no +)" value={form.whatsapp} onChange={set("whatsapp")} required />
                <Input id="phone" type="tel" label="Store Phone Number (optional)" placeholder="e.g. 2348000001234" value={form.phone} onChange={set("phone")} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line p-6">
            <h2 className="font-body text-[11px] font-semibold uppercase tracking-[2px]">Your Account</h2>
            <div className="mt-5 space-y-5">
              <Input id="name" type="text" label="Full Name" placeholder="Your name" value={form.name} onChange={set("name")} required />
              <Input id="email" type="email" label="Email" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
              <Input id="password" type="password" label="Password" placeholder="Min. 6 characters" value={form.password} onChange={set("password")} minLength={6} required />
            </div>
          </section>

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Submitting application..." : "Submit Application"}
          </Button>
          <p className="text-center font-body text-[12px] text-muted">Already a seller? <Link href="/login" className="text-black underline">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
