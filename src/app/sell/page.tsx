"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";

type FormState = {
  name: string;
  email: string;
  password: string;
  storeName: string;
  whatsapp: string;
  phone: string;
  email2: string;
  instagram: string;
  preferredContact: string;
  description: string;
  category: string;
  country: string;
  state: string;
  city: string;
  area: string;
  physicalAddress: string;
  mapLocation: string;
  pickup: boolean;
  delivery: boolean;
  aboutStore: string;
  productsDescription: string;
  openingHours: string;
  deliveryAreas: string;
  pickupInformation: string;
  paymentMethods: string;
  returnPolicy: string;
};

const SECTION_LABEL =
  "font-body text-[11px] font-semibold uppercase tracking-[2px] text-black";

const inputClass =
  "mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 font-body text-[13px] text-black outline-none transition focus:border-[#005C29]";

const textareaClass =
  "mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 font-body text-[13px] text-black outline-none transition focus:border-[#005C29]";

const REQUIRED_NOTE = (
  <span className="ml-1 font-body text-[11px] font-normal normal-case tracking-normal text-muted">
    (required)
  </span>
);
const OPTIONAL_NOTE = (
  <span className="ml-1 font-body text-[11px] font-normal normal-case tracking-normal text-muted">
    (optional)
  </span>
);

export default function SellPage() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    storeName: "",
    whatsapp: "",
    phone: "",
    email2: "",
    instagram: "",
    preferredContact: "",
    description: "",
    category: "",
    country: "Nigeria",
    state: "",
    city: "",
    area: "",
    physicalAddress: "",
    mapLocation: "",
    pickup: false,
    delivery: false,
    aboutStore: "",
    productsDescription: "",
    openingHours: "",
    deliveryAreas: "",
    pickupInformation: "",
    paymentMethods: "",
    returnPolicy: "",
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set =
    (key: keyof FormState) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const setBool =
    (key: "pickup" | "delivery") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.checked }));

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Logo must be a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be smaller than 2 MB.");
      return;
    }
    setError("");
    setLogo(file);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
  };

  const onCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Cover image must be a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Cover image must be smaller than 5 MB.");
      return;
    }
    setError("");
    setCoverImage(file);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData();
    fd.set("name", form.name);
    fd.set("email", form.email);
    fd.set("password", form.password);
    fd.set("storeName", form.storeName);
    fd.set("whatsapp", form.whatsapp);
    fd.set("phone", form.phone);
    fd.set("email2", form.email2);
    fd.set("instagram", form.instagram);
    fd.set("preferredContact", form.preferredContact);
    fd.set("description", form.description);
    fd.set("category", form.category);
    fd.set("country", form.country);
    fd.set("state", form.state);
    fd.set("city", form.city);
    fd.set("area", form.area);
    fd.set("physicalAddress", form.physicalAddress);
    fd.set("mapLocation", form.mapLocation);
    fd.set("pickup", form.pickup ? "on" : "");
    fd.set("delivery", form.delivery ? "on" : "");
    fd.set("aboutStore", form.aboutStore);
    fd.set("productsDescription", form.productsDescription);
    fd.set("openingHours", form.openingHours);
    fd.set("deliveryAreas", form.deliveryAreas);
    fd.set("pickupInformation", form.pickupInformation);
    fd.set("paymentMethods", form.paymentMethods);
    fd.set("returnPolicy", form.returnPolicy);
    if (logo) fd.set("logo", logo);
    if (coverImage) fd.set("coverImage", coverImage);

    try {
      const res = await fetch("/api/auth/vendor-signup", {
        method: "POST",
        body: fd,
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
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
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
      <div className="mx-auto max-w-3xl px-8">
        <div className="mb-4 h-[2px] w-12 bg-gold" />
        <h1 className="font-heading text-[28px] font-medium text-black">Open your store on Larkvine</h1>
        <p className="mt-3 font-body text-[13px] text-muted">
          Apply to become a seller, list your products, and receive order notifications directly on your own WhatsApp number. Applications are reviewed by our team before your store goes live.
        </p>

        {error && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-10 space-y-8">
          {/* STORE IDENTITY */}
          <section className="rounded-2xl border border-line p-6">
            <h2 className={SECTION_LABEL}>Store Identity</h2>
            <div className="mt-5 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="storeName" className="font-body text-[12px] font-medium text-black">Store Name{REQUIRED_NOTE}</label>
                  <input id="storeName" type="text" className={inputClass} placeholder="e.g. Trendy Closet" value={form.storeName} onChange={set("storeName")} required />
                </div>
                <div>
                  <label htmlFor="category" className="font-body text-[12px] font-medium text-black">Category{OPTIONAL_NOTE}</label>
                  <input id="category" type="text" className={inputClass} placeholder="e.g. Women's fashion, Accessories" value={form.category} onChange={set("category")} />
                </div>
              </div>

              <div>
                <label htmlFor="logo" className="font-body text-[12px] font-medium text-black">Store Logo{OPTIONAL_NOTE}</label>
                <input id="logo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onLogo} className={`${inputClass} cursor-pointer`} />
                {logoPreview && (
                  <div className="mt-3 flex items-center gap-3">
                    <Image src={logoPreview} alt="Logo preview" width={64} height={64} className="h-16 w-16 rounded-full border border-line object-cover" unoptimized />
                    <span className="font-body text-[12px] text-muted">{logo?.name}</span>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="coverImage" className="font-body text-[12px] font-medium text-black">Cover Image{OPTIONAL_NOTE}</label>
                <input id="coverImage" type="file" accept="image/jpeg,image/png,image/webp" onChange={onCover} className={`${inputClass} cursor-pointer`} />
                {coverPreview && (
                  <div className="mt-3 inline-block overflow-hidden rounded-xl border border-line">
                    <Image src={coverPreview} alt="Cover preview" width={240} height={90} className="h-auto w-full max-w-[320px] object-cover" unoptimized />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="description" className="font-body text-[12px] font-medium text-black">Store Description{OPTIONAL_NOTE}</label>
                <textarea id="description" rows={3} className={textareaClass} placeholder="Tell shoppers a little about your store and what you sell…" value={form.description} onChange={set("description")} />
              </div>
            </div>
          </section>

          {/* LOCATION */}
          <section className="rounded-2xl border border-line p-6">
            <h2 className={SECTION_LABEL}>Location</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="country" className="font-body text-[12px] font-medium text-black">Country{REQUIRED_NOTE}</label>
                <input id="country" type="text" className={inputClass} value={form.country} onChange={set("country")} required />
              </div>
              <div>
                <label htmlFor="state" className="font-body text-[12px] font-medium text-black">State{REQUIRED_NOTE}</label>
                <input id="state" type="text" className={inputClass} placeholder="e.g. Lagos" value={form.state} onChange={set("state")} required />
              </div>
              <div>
                <label htmlFor="city" className="font-body text-[12px] font-medium text-black">City{REQUIRED_NOTE}</label>
                <input id="city" type="text" className={inputClass} placeholder="e.g. Lekki" value={form.city} onChange={set("city")} required />
              </div>
              <div>
                <label htmlFor="area" className="font-body text-[12px] font-medium text-black">Area{OPTIONAL_NOTE}</label>
                <input id="area" type="text" className={inputClass} placeholder="e.g. Ajah, VI" value={form.area} onChange={set("area")} />
              </div>
              <div>
                <label htmlFor="physicalAddress" className="font-body text-[12px] font-medium text-black">Physical Address{OPTIONAL_NOTE}</label>
                <input id="physicalAddress" type="text" className={inputClass} placeholder="Business address or pickup point (private by default)" value={form.physicalAddress} onChange={set("physicalAddress")} />
              </div>
              <div>
                <label htmlFor="mapLocation" className="font-body text-[12px] font-medium text-black">Map Location / Link{OPTIONAL_NOTE}</label>
                <input id="mapLocation" type="text" className={inputClass} placeholder="Google Maps link or coordinates" value={form.mapLocation} onChange={set("mapLocation")} />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-3 font-body text-[13px] text-black">
                <input type="checkbox" checked={form.pickup} onChange={setBool("pickup")} className="h-4 w-4 accent-[#005C29]" />
                Pickup available
              </label>
              <label className="flex cursor-pointer items-center gap-3 font-body text-[13px] text-black">
                <input type="checkbox" checked={form.delivery} onChange={setBool("delivery")} className="h-4 w-4 accent-[#005C29]" />
                Delivery available
              </label>
            </div>
          </section>

          {/* CONTACT */}
          <section className="rounded-2xl border border-line p-6">
            <h2 className={SECTION_LABEL}>Contact</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="whatsapp" className="font-body text-[12px] font-medium text-black">WhatsApp Number{REQUIRED_NOTE}</label>
                <input id="whatsapp" type="tel" className={inputClass} placeholder="e.g. 2348000001234 (international, no +)" value={form.whatsapp} onChange={set("whatsapp")} required />
              </div>
              <div>
                <label htmlFor="phone" className="font-body text-[12px] font-medium text-black">Phone Number{OPTIONAL_NOTE}</label>
                <input id="phone" type="tel" className={inputClass} placeholder="e.g. 2348000001234" value={form.phone} onChange={set("phone")} />
              </div>
              <div>
                <label htmlFor="email2" className="font-body text-[12px] font-medium text-black">Email{OPTIONAL_NOTE}</label>
                <input id="email2" type="email" className={inputClass} placeholder="store@example.com" value={form.email2} onChange={set("email2")} />
              </div>
              <div>
                <label htmlFor="instagram" className="font-body text-[12px] font-medium text-black">Instagram{OPTIONAL_NOTE}</label>
                <input id="instagram" type="text" className={inputClass} placeholder="e.g. @yourstore or profile URL" value={form.instagram} onChange={set("instagram")} />
              </div>
              <div>
                <label htmlFor="preferredContact" className="font-body text-[12px] font-medium text-black">Preferred Contact Method{OPTIONAL_NOTE}</label>
                <select id="preferredContact" className={inputClass} value={form.preferredContact} onChange={set("preferredContact")}>
                  <option value="">Select…</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
            </div>
          </section>

          {/* STORE INFORMATION */}
          <section className="rounded-2xl border border-line p-6">
            <h2 className={SECTION_LABEL}>Store Information</h2>
            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="aboutStore" className="font-body text-[12px] font-medium text-black">About the Store{OPTIONAL_NOTE}</label>
                <textarea id="aboutStore" rows={3} className={textareaClass} placeholder="Tell shoppers about your brand, your story…" value={form.aboutStore} onChange={set("aboutStore")} />
              </div>
              <div>
                <label htmlFor="productsDescription" className="font-body text-[12px] font-medium text-black">What You Sell{OPTIONAL_NOTE}</label>
                <textarea id="productsDescription" rows={2} className={textareaClass} placeholder="Describe your products and categories" value={form.productsDescription} onChange={set("productsDescription")} />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="openingHours" className="font-body text-[12px] font-medium text-black">Opening Hours{OPTIONAL_NOTE}</label>
                  <input id="openingHours" type="text" className={inputClass} placeholder="e.g. Mon–Sat, 9am–6pm" value={form.openingHours} onChange={set("openingHours")} />
                </div>
                <div>
                  <label htmlFor="deliveryAreas" className="font-body text-[12px] font-medium text-black">Delivery Areas{OPTIONAL_NOTE}</label>
                  <input id="deliveryAreas" type="text" className={inputClass} placeholder="e.g. Nationwide, Lagos only" value={form.deliveryAreas} onChange={set("deliveryAreas")} />
                </div>
              </div>
              <div>
                <label htmlFor="pickupInformation" className="font-body text-[12px] font-medium text-black">Pickup Information{OPTIONAL_NOTE}</label>
                <textarea id="pickupInformation" rows={2} className={textareaClass} placeholder="Where and when customers can pick up orders" value={form.pickupInformation} onChange={set("pickupInformation")} />
              </div>
              <div>
                <label htmlFor="paymentMethods" className="font-body text-[12px] font-medium text-black">Payment Methods{OPTIONAL_NOTE}</label>
                <input id="paymentMethods" type="text" className={inputClass} placeholder="e.g. Bank transfer, Paystack, Cash on delivery" value={form.paymentMethods} onChange={set("paymentMethods")} />
              </div>
              <div>
                <label htmlFor="returnPolicy" className="font-body text-[12px] font-medium text-black">Return / Exchange Policy{OPTIONAL_NOTE}</label>
                <textarea id="returnPolicy" rows={3} className={textareaClass} placeholder="Describe your returns and exchange policy" value={form.returnPolicy} onChange={set("returnPolicy")} />
              </div>
            </div>
          </section>

          {/* ACCOUNT */}
          <section className="rounded-2xl border border-line p-6">
            <h2 className={SECTION_LABEL}>Your Account</h2>
            <div className="mt-5 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="name" className="font-body text-[12px] font-medium text-black">Full Name{REQUIRED_NOTE}</label>
                  <input id="name" type="text" className={inputClass} placeholder="Your name" value={form.name} onChange={set("name")} required />
                </div>
                <div>
                  <label htmlFor="email" className="font-body text-[12px] font-medium text-black">Account Email{REQUIRED_NOTE}</label>
                  <input id="email" type="email" className={inputClass} placeholder="you@example.com" value={form.email} onChange={set("email")} required />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="font-body text-[12px] font-medium text-black">Password{REQUIRED_NOTE}</label>
                <input id="password" type="password" className={inputClass} placeholder="Min. 8 characters" value={form.password} onChange={set("password")} minLength={8} required />
              </div>
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
