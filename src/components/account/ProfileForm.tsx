"use client";

import { useActionState, useState } from "react";
import { saveProfile, type ProfileState } from "@/app/account/profile/actions";
import { GARMENT_SIZES, type Measurements } from "@/lib/measurements";

type Profile = {
  name: string; email: string; phone: string; whatsapp: string; gender: string;
  address: string; state: string; city: string; zip: string; deliveryInfo: string;
  measurements: Measurements;
};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  const [size, setSize] = useState<string>(String(profile.measurements.size ?? ""));
  const inputClass = "h-[46px] w-full border-b border-black bg-transparent px-1 font-body text-[14px] outline-none focus:border-gold";

  return <form action={action} className="mt-8 space-y-10">
    {state.error && <p role="alert" className="border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700">{state.error}</p>}
    {state.success && <p className="border border-green-200 bg-green-50 p-4 font-body text-[13px] text-green-800">{state.success}</p>}
    <section>
      <h2 className="font-heading text-[20px] font-medium">Personal Information</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <label className="font-body text-[12px] text-muted">Full Name *<input className={inputClass} name="name" defaultValue={profile.name} required /></label>
        <label className="font-body text-[12px] text-muted">Email Address<input className={`${inputClass} text-muted`} value={profile.email} readOnly /></label>
        <label className="font-body text-[12px] text-muted">Phone Number *<input className={inputClass} name="phone" type="tel" defaultValue={profile.phone} required /></label>
        <label className="font-body text-[12px] text-muted">WhatsApp Number *<input className={inputClass} name="whatsapp" type="tel" defaultValue={profile.whatsapp} required /></label>
        <label className="font-body text-[12px] text-muted">Gender<select className={inputClass} name="gender" defaultValue={profile.gender}><option value="">Prefer not to say</option><option value="Male">Male</option><option value="Female">Female</option></select></label>
      </div>
    </section>
    <section>
      <h2 className="font-heading text-[20px] font-medium">Delivery Information</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <label className="font-body text-[12px] text-muted md:col-span-2">Delivery Address *<input className={inputClass} name="address" defaultValue={profile.address} required /></label>
        <label className="font-body text-[12px] text-muted">State *<input className={inputClass} name="state" defaultValue={profile.state} required /></label>
        <label className="font-body text-[12px] text-muted">City *<input className={inputClass} name="city" defaultValue={profile.city} required /></label>
        <label className="font-body text-[12px] text-muted">Postal Code<input className={inputClass} name="zip" defaultValue={profile.zip} /></label>
        <label className="font-body text-[12px] text-muted md:col-span-2">Additional Delivery Information<textarea className="mt-2 min-h-24 w-full border border-line p-3 font-body text-[14px] outline-none focus:border-gold" name="deliveryInfo" defaultValue={profile.deliveryInfo} /></label>
      </div>
    </section>
    <section>
      <h2 className="font-heading text-[20px] font-medium">Garment Size</h2>
      <p className="mt-1 font-body text-[12px] text-muted">Choose your standard size. This is used to pre-fill your future orders.</p>
      <div className="mt-5 flex flex-wrap gap-3">{GARMENT_SIZES.map((s) => <button key={s} type="button" onClick={() => setSize(s)} aria-pressed={size === s} className={`min-h-12 min-w-[68px] rounded-full border px-6 font-body text-[12px] font-bold uppercase tracking-[1.2px] transition-all ${size === s ? "border-gold bg-gold text-black" : "border-line text-muted hover:border-black"}`}>{s}</button>)}</div>
      <input type="hidden" name="size" value={size} />
    </section>
    <button disabled={pending || !size} className="cta-primary">{pending ? "Saving..." : "Save Profile"}</button>
  </form>;
}
