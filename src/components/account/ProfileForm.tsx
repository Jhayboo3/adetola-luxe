"use client";

import { useActionState, useState } from "react";
import { saveProfile, type ProfileState } from "@/app/account/profile/actions";
import { FEMALE_MEASUREMENTS, MALE_MEASUREMENTS, type Gender, type Measurements } from "@/lib/measurements";

type Profile = {
  name: string; email: string; phone: string; whatsapp: string; gender: string;
  address: string; state: string; city: string; zip: string; deliveryInfo: string;
  measurementUnit: string; measurements: Measurements;
};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  const [gender, setGender] = useState<Gender | "">(profile.gender === "Male" || profile.gender === "Female" ? profile.gender : "");
  const fields = gender === "Male" ? MALE_MEASUREMENTS : gender === "Female" ? FEMALE_MEASUREMENTS : [];
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
        <label className="font-body text-[12px] text-muted">Gender *<select className={inputClass} name="gender" value={gender} onChange={(event) => setGender(event.target.value as Gender | "")} required><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option></select></label>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-heading text-[20px] font-medium">Body Measurements</h2><p className="mt-1 font-body text-[12px] text-muted">Only measurements for your selected gender are saved and used for future orders.</p></div><label className="font-body text-[12px] text-muted">Measurement Unit<select className="ml-3 border border-line bg-white p-2" name="measurementUnit" defaultValue={profile.measurementUnit}><option value="inches">Inches</option><option value="centimeters">Centimeters</option></select></label></div>
      {!gender ? <p className="mt-6 rounded-xl bg-[#F7F2E8] p-5 font-body text-[13px]">Select your gender to see the required measurement fields.</p> : <div key={gender} className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3">{fields.map(([key, label]) => <label key={key} className="font-body text-[11px] text-muted sm:text-[12px]">{label} *<input className={inputClass} name={key} type="number" inputMode="decimal" min="0.01" max="200" step="0.01" defaultValue={profile.gender === gender ? profile.measurements[key] ?? "" : ""} required /></label>)}</div>}
    </section>
    <button disabled={pending || !gender} className="min-h-[48px] rounded-full bg-primary px-8 py-3 font-body text-[11px] font-semibold uppercase tracking-[1px] text-white disabled:opacity-50">{pending ? "Saving..." : "Save Profile & Measurements"}</button>
  </form>;
}
