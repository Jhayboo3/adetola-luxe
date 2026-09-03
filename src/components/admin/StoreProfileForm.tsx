"use client";

import Image from "next/image";
import { useActionState, useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import {
  updateStoreLogo,
  removeStoreLogo,
  updateStoreCover,
  removeStoreCover,
  updateStoreProfile,
  type StoreProfileState,
} from "@/app/admin/(store)/store/actions";

type StoreShape = {
  name: string;
  slug: string;
  logo: string | null;
  coverImage: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  instagramUrl: string | null;
  preferredContactMethod: string | null;
  description: string | null;
  category: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  area: string | null;
  physicalAddress: string | null;
  mapLocation: string | null;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  aboutStore: string | null;
  productsDescription: string | null;
  openingHours: string | null;
  deliveryAreas: string | null;
  pickupInformation: string | null;
  paymentMethods: string | null;
  returnPolicy: string | null;
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const FIELD_LABEL = "font-body text-[12px] font-medium text-black";
const OPT_LABEL = "ml-1 font-normal normal-case tracking-normal text-muted";
const inputClass =
  "mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 font-body text-[13px] text-black outline-none transition focus:border-[#005C29]";
const textareaClass =
  "mt-2 w-full rounded-lg border border-line bg-white px-4 py-3 font-body text-[13px] text-black outline-none transition focus:border-[#005C29]";
const SECTION_TITLE =
  "font-heading text-[17px] font-medium text-black";

function Feedback({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <div
      className={`mt-4 rounded-lg border p-4 font-body text-[13px] ${
        error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-800"
      }`}
    >
      {error || success}
    </div>
  );
}

export default function StoreProfileForm({ store }: { store: StoreShape }) {
  const [logoState, logoAction, logoPending] = useActionState(updateStoreLogo, {});
  const [coverState, coverAction, coverPending] = useActionState(updateStoreCover, {});
  const [removeLogoState, removeLogoAction, removeLogoPending] = useActionState(removeStoreLogo, {});
  const [removeCoverState, removeCoverAction, removeCoverPending] = useActionState(removeStoreCover, {});
  const [profileState, profileAction, profilePending] = useActionState<StoreProfileState, FormData>(updateStoreProfile, {});
  const [savedTick, setSavedTick] = useState(false);
  useEffect(() => {
    if (profileState.success) {
      const t = setTimeout(() => setSavedTick(true), 0);
      const t2 = setTimeout(() => setSavedTick(false), 3000);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }
  }, [profileState.success]);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED.includes(file.type)) { window.alert("Please use a JPG, PNG or WebP image."); return; }
    if (file.size > MAX_LOGO_BYTES) { window.alert("Logo must be smaller than 2 MB."); return; }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
  };

  const onCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED.includes(file.type)) { window.alert("Please use a JPG, PNG or WebP image."); return; }
    if (file.size > MAX_COVER_BYTES) { window.alert("Cover image must be smaller than 5 MB."); return; }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(file));
  };

  const d = (v: string | null | undefined) => v ?? "";

  return (
    <div className="max-w-2xl space-y-8">
      {/* Logo */}
      <section className="rounded-[24px] border border-line bg-white p-6">
        <h2 className={SECTION_TITLE}>Store Logo</h2>
        <p className="mt-1 font-body text-[12px] leading-relaxed text-muted">
          A circular logo shown on your store cards, storefront and product listings.
        </p>
        <div className="mt-4 flex items-start gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-line">
            {logoPreview ? (
              <Image src={logoPreview} alt="Logo preview" width={160} height={160} className="h-full w-full object-cover" unoptimized />
            ) : store.logo ? (
              <Image src={store.logo} alt="Store logo" width={160} height={160} className="h-full w-full object-cover" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-black text-white">
                <span className="font-heading text-[28px]">{store.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <form action={logoAction}>
              <input
                name="logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onLogo}
                className="w-full cursor-pointer rounded-xl border border-line bg-white p-2 font-body text-[12px] text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-body file:text-[11px] file:font-semibold file:uppercase file:tracking-[1px] file:text-black hover:file:bg-primary hover:file:text-white"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="submit" disabled={logoPending || !logoPreview} className="min-h-9 px-4 text-[11px]">
                  {logoPending ? "Saving…" : "Save Logo"}
                </Button>
              </div>
            </form>
            {store.logo && (
              <form action={removeLogoAction} className="mt-1">
                <Button type="submit" variant="ghost" className="min-h-8 px-3 text-[11px] text-red-600" disabled={removeLogoPending}>
                  Remove Logo
                </Button>
              </form>
            )}
            <Feedback error={logoState.error || removeLogoState.error} success={logoState.success || removeLogoState.success} />
          </div>
        </div>
      </section>

      {/* Cover image */}
      <section className="rounded-[24px] border border-line bg-white p-6">
        <h2 className={SECTION_TITLE}>Cover Image</h2>
        <p className="mt-1 font-body text-[12px] leading-relaxed text-muted">
          A wide banner image shown at the top of your storefront.
        </p>
        <div className="mt-4">
          {coverPreview ? (
            <Image src={coverPreview} alt="Cover preview" width={640} height={240} className="aspect-video w-full max-w-sm rounded-xl border border-line object-cover" unoptimized />
          ) : store.coverImage ? (
            <Image src={store.coverImage} alt="Store cover" width={640} height={240} className="aspect-video w-full max-w-sm rounded-xl border border-line object-cover" unoptimized />
          ) : (
            <div className="flex aspect-video w-full max-w-sm items-center justify-center rounded-xl border border-dashed border-line bg-[#F7F3ED]">
              <span className="font-body text-[12px] text-muted">No cover image</span>
            </div>
          )}
          <form action={coverAction} className="mt-3">
            <input
              name="cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onCover}
              className="w-full cursor-pointer rounded-xl border border-line bg-white p-2 font-body text-[12px] text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-body file:text-[11px] file:font-semibold file:uppercase file:tracking-[1px] file:text-black hover:file:bg-primary hover:file:text-white"
            />
            <div className="mt-3 flex gap-2">
              <Button type="submit" disabled={coverPending || !coverPreview} className="min-h-9 px-4 text-[11px]">
                {coverPending ? "Saving…" : "Save Cover"}
              </Button>
            </div>
          </form>
          {store.coverImage && (
            <form action={removeCoverAction} className="mt-1">
              <Button type="submit" variant="ghost" className="min-h-8 px-3 text-[11px] text-red-600" disabled={removeCoverPending}>
                Remove Cover
              </Button>
            </form>
          )}
          <Feedback error={coverState.error || removeCoverState.error} success={coverState.success || removeCoverState.success} />
        </div>
      </section>

      {/* Profile fields */}
      <form action={profileAction}>
        <section className="rounded-[24px] border border-line bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className={SECTION_TITLE}>Store Profile</h2>
            {savedTick && <span className="font-body text-[12px] text-green-700">Saved ✓</span>}
          </div>
          <p className="mt-1 font-body text-[12px] text-muted">Update your public store information. This is shown on your storefront.</p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={FIELD_LABEL}>Store Name</label>
              <input className={`${inputClass} text-muted`} value={store.name} readOnly />
            </div>
            <div>
              <label className={FIELD_LABEL}>Category<span className={OPT_LABEL}>(optional)</span></label>
              <input className={inputClass} name="category" defaultValue={d(store.category)} placeholder="e.g. Women's fashion" />
            </div>
            <div>
              <label className={FIELD_LABEL}>Country<span className={OPT_LABEL}>(optional)</span></label>
              <input className={inputClass} name="country" defaultValue={d(store.country)} placeholder="e.g. Nigeria" />
            </div>
            <div>
              <label className={FIELD_LABEL}>State<span className={OPT_LABEL}>(optional)</span></label>
              <input className={inputClass} name="state" defaultValue={d(store.state)} placeholder="e.g. Lagos" />
            </div>
            <div>
              <label className={FIELD_LABEL}>City<span className={OPT_LABEL}>(optional)</span></label>
              <input className={inputClass} name="city" defaultValue={d(store.city)} placeholder="e.g. Lekki" />
            </div>
            <div>
              <label className={FIELD_LABEL}>Area<span className={OPT_LABEL}>(optional)</span></label>
              <input className={inputClass} name="area" defaultValue={d(store.area)} placeholder="e.g. Ajah" />
            </div>
            <div>
              <label className={FIELD_LABEL}>Physical Address<span className={OPT_LABEL}>(optional, kept private)</span></label>
              <input className={inputClass} name="physicalAddress" defaultValue={d(store.physicalAddress)} placeholder="Business address or pickup point" />
            </div>
            <div>
              <label className={FIELD_LABEL}>Map Location / Link<span className={OPT_LABEL}>(optional)</span></label>
              <input className={inputClass} name="mapLocation" defaultValue={d(store.mapLocation)} placeholder="Google Maps link or coordinates" />
            </div>
            <div className="md:col-span-2">
              <label className={FIELD_LABEL}>Store Description<span className={OPT_LABEL}>(optional)</span></label>
              <textarea className={textareaClass} name="description" defaultValue={d(store.description)} rows={2} placeholder="Short tagline for your store" />
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-3 font-body text-[13px] text-black">
                <input type="checkbox" name="pickupAvailable" defaultChecked={store.pickupAvailable} className="h-4 w-4 accent-[#005C29]" />
                Pickup available
              </label>
              <label className="flex cursor-pointer items-center gap-3 font-body text-[13px] text-black">
                <input type="checkbox" name="deliveryAvailable" defaultChecked={store.deliveryAvailable} className="h-4 w-4 accent-[#005C29]" />
                Delivery available
              </label>
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <h3 className="font-heading text-[15px] font-medium text-black">Contact Details</h3>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <label className={FIELD_LABEL}>WhatsApp Number</label>
                <input className={inputClass} name="whatsapp" defaultValue={d(store.whatsapp)} placeholder="e.g. 2348000001234" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Phone Number<span className={OPT_LABEL}>(optional)</span></label>
                <input className={inputClass} name="phone" defaultValue={d(store.phone)} placeholder="e.g. 2348000001234" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Email<span className={OPT_LABEL}>(optional)</span></label>
                <input className={inputClass} name="email" type="email" defaultValue={d(store.email)} placeholder="store@example.com" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Instagram<span className={OPT_LABEL}>(optional)</span></label>
                <input className={inputClass} name="instagramUrl" defaultValue={d(store.instagramUrl)} placeholder="@yourstore or profile URL" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Preferred Contact Method<span className={OPT_LABEL}>(optional)</span></label>
                <select className={inputClass} name="preferredContactMethod" defaultValue={d(store.preferredContactMethod)}>
                  <option value="">Select…</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <h3 className="font-heading text-[15px] font-medium text-black">Store Information</h3>
            <div className="mt-4 space-y-5">
              <div>
                <label className={FIELD_LABEL}>About the Store<span className={OPT_LABEL}>(optional)</span></label>
                <textarea className={textareaClass} name="aboutStore" defaultValue={d(store.aboutStore)} rows={3} placeholder="Tell shoppers about your brand and story" />
              </div>
              <div>
                <label className={FIELD_LABEL}>What You Sell<span className={OPT_LABEL}>(optional)</span></label>
                <textarea className={textareaClass} name="productsDescription" defaultValue={d(store.productsDescription)} rows={2} placeholder="Describe your products" />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={FIELD_LABEL}>Opening Hours<span className={OPT_LABEL}>(optional)</span></label>
                  <input className={inputClass} name="openingHours" defaultValue={d(store.openingHours)} placeholder="e.g. Mon–Sat, 9am–6pm" />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Delivery Areas<span className={OPT_LABEL}>(optional)</span></label>
                  <input className={inputClass} name="deliveryAreas" defaultValue={d(store.deliveryAreas)} placeholder="e.g. Nationwide, Lagos only" />
                </div>
              </div>
              <div>
                <label className={FIELD_LABEL}>Pickup Information<span className={OPT_LABEL}>(optional)</span></label>
                <textarea className={textareaClass} name="pickupInformation" defaultValue={d(store.pickupInformation)} rows={2} placeholder="Where/when customers can pick up orders" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Payment Methods<span className={OPT_LABEL}>(optional)</span></label>
                <input className={inputClass} name="paymentMethods" defaultValue={d(store.paymentMethods)} placeholder="e.g. Bank transfer, Paystack, COD" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Return / Exchange Policy<span className={OPT_LABEL}>(optional)</span></label>
                <textarea className={textareaClass} name="returnPolicy" defaultValue={d(store.returnPolicy)} rows={3} placeholder="Describe your returns and exchange policy" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-line pt-6">
            <Button type="submit" disabled={profilePending} className="min-h-10 px-6 text-[12px]">
              {profilePending ? "Saving…" : "Save Profile"}
            </Button>
            {savedTick && <span className="font-body text-[12px] text-green-700">Saved ✓</span>}
          </div>
          <Feedback error={profileState.error} success={undefined} />
        </section>
      </form>
    </div>
  );
}
