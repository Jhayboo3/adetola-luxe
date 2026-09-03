"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { useTransition } from "react";
import {
  savePersonalInfo,
  saveDeliveryInfo,
  saveGarmentSize,
  type ProfileState,
} from "@/app/account/profile/actions";
import { GARMENT_SIZES, type Measurements } from "@/lib/measurements";

type Profile = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  gender: string;
  address: string;
  state: string;
  city: string;
  zip: string;
  deliveryInfo: string;
  measurements: Measurements;
};

function SectionSaveButton({
  pending,
  saved,
}: {
  pending: boolean;
  saved: boolean;
}) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="cta-primary"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {saved && (
        <span className="font-body text-[12px] text-green-700 animate-fade-out">
          Saved
        </span>
      )}
    </div>
  );
}

function useSuccessOnce(success: string | undefined) {
  const [show, setShow] = useState(false);
  const prev = useRef(false);
  useEffect(() => {
    if (success && !prev.current) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 3000);
      prev.current = true;
      return () => clearTimeout(t);
    }
    if (!success) {
      prev.current = false;
    }
  }, [success]);
  return show;
}

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [personalState, personalAction, personalPending] =
    useActionState<ProfileState, FormData>(savePersonalInfo, {});
  const [deliveryState, deliveryAction, deliveryPending] =
    useActionState<ProfileState, FormData>(saveDeliveryInfo, {});
  const [sizeState, sizeAction, sizePending] =
    useActionState<ProfileState, FormData>(saveGarmentSize, {});

  const [size, setSize] = useState<string>(
    String(profile.measurements.size ?? "")
  );
  const inputClass =
    "h-[46px] w-full border-b border-black bg-transparent px-1 font-body text-[14px] outline-none focus:border-gold";

  const personalSaved = useSuccessOnce(personalState.success);
  const deliverySaved = useSuccessOnce(deliveryState.success);
  const sizeSaved = useSuccessOnce(sizeState.success);

  const [dirty, setDirty] = useState({
    personal: false,
    delivery: false,
    size: false,
  });

  const [personalSaving, startPersonalTransition] = useTransition();
  const [deliverySaving, startDeliveryTransition] = useTransition();
  const [sizeSaving, startSizeTransition] = useTransition();

  const personalLoading = personalPending || personalSaving;
  const deliveryLoading = deliveryPending || deliverySaving;
  const sizeLoading = sizePending || sizeSaving;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.personal || dirty.delivery || dirty.size) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const markDirty = (section: "personal" | "delivery") => () => {
    setDirty((d) => ({ ...d, [section]: true }));
  };

  const handlePersonalSubmit = (formData: FormData) => {
    startPersonalTransition(() => {
      personalAction(formData);
    });
  };

  const handleDeliverySubmit = (formData: FormData) => {
    startDeliveryTransition(() => {
      deliveryAction(formData);
    });
  };

  const handleSizeSubmit = (formData: FormData) => {
    startSizeTransition(() => {
      sizeAction(formData);
    });
  };

  const hasDirty = dirty.personal || dirty.delivery || dirty.size;

  return (
    <>
      {hasDirty && (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-white px-5 py-2.5 font-body text-[12px] text-muted shadow-lg"
          role="status"
        >
          You have unsaved changes
        </div>
      )}

      <form
        action={handlePersonalSubmit}
        className="mt-8"
        onSubmit={() => setDirty((d) => ({ ...d, personal: false }))}
      >
        <section>
          <h2 className="font-heading text-[20px] font-medium">
            Personal Information
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <label className="font-body text-[12px] text-muted">
              Full Name *
              <input
                className={inputClass}
                name="name"
                defaultValue={profile.name}
                required
                onChange={markDirty("personal")}
              />
            </label>
            <label className="font-body text-[12px] text-muted">
              Email Address
              <input
                className={`${inputClass} text-muted`}
                value={profile.email}
                readOnly
              />
            </label>
            <label className="font-body text-[12px] text-muted">
              Phone Number *
              <input
                className={inputClass}
                name="phone"
                type="tel"
                defaultValue={profile.phone}
                required
                onChange={markDirty("personal")}
              />
            </label>
            <label className="font-body text-[12px] text-muted">
              WhatsApp Number *
              <input
                className={inputClass}
                name="whatsapp"
                type="tel"
                defaultValue={profile.whatsapp}
                required
                onChange={markDirty("personal")}
              />
            </label>
            <label className="font-body text-[12px] text-muted">
              Gender
              <select
                className={inputClass}
                name="gender"
                defaultValue={profile.gender}
                onChange={markDirty("personal")}
              >
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
          </div>
          {personalState.error && (
            <p
              role="alert"
              className="mt-4 border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700"
            >
              {personalState.error}
            </p>
          )}
          <SectionSaveButton
            pending={personalLoading}
            saved={personalSaved}
          />
        </section>
      </form>

      <form
        action={handleDeliverySubmit}
        onSubmit={() => setDirty((d) => ({ ...d, delivery: false }))}
      >
        <section className="mt-10">
          <h2 className="font-heading text-[20px] font-medium">
            Delivery Information
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <label className="font-body text-[12px] text-muted md:col-span-2">
              Delivery Address *
              <input
                className={inputClass}
                name="address"
                defaultValue={profile.address}
                required
                onChange={markDirty("delivery")}
              />
            </label>
            <label className="font-body text-[12px] text-muted">
              State *
              <input
                className={inputClass}
                name="state"
                defaultValue={profile.state}
                required
                onChange={markDirty("delivery")}
              />
            </label>
            <label className="font-body text-[12px] text-muted">
              City *
              <input
                className={inputClass}
                name="city"
                defaultValue={profile.city}
                required
                onChange={markDirty("delivery")}
              />
            </label>
            <label className="font-body text-[12px] text-muted">
              Postal Code
              <input
                className={inputClass}
                name="zip"
                defaultValue={profile.zip}
                onChange={markDirty("delivery")}
              />
            </label>
            <label className="font-body text-[12px] text-muted md:col-span-2">
              Additional Delivery Information
              <textarea
                className="mt-2 min-h-24 w-full border border-line p-3 font-body text-[14px] outline-none focus:border-gold"
                name="deliveryInfo"
                defaultValue={profile.deliveryInfo}
                onChange={markDirty("delivery")}
              />
            </label>
          </div>
          {deliveryState.error && (
            <p
              role="alert"
              className="mt-4 border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700"
            >
              {deliveryState.error}
            </p>
          )}
          <SectionSaveButton
            pending={deliveryLoading}
            saved={deliverySaved}
          />
        </section>
      </form>

      <form
        action={handleSizeSubmit}
        onSubmit={() => setDirty((d) => ({ ...d, size: false }))}
      >
        <section className="mt-10">
          <h2 className="font-heading text-[20px] font-medium">
            Garment Size
          </h2>
          <p className="mt-1 font-body text-[12px] text-muted">
            Choose your standard size. This is used to pre-fill your future
            orders.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {GARMENT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSize(s);
                  setDirty((d) => ({ ...d, size: true }));
                }}
                aria-pressed={size === s}
                className={`min-h-12 min-w-[68px] rounded-full border px-6 font-body text-[12px] font-bold uppercase tracking-[1.2px] transition-all ${
                  size === s
                    ? "border-gold bg-gold text-black"
                    : "border-line text-muted hover:border-black"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input type="hidden" name="size" value={size} />
          {sizeState.error && (
            <p
              role="alert"
              className="mt-4 border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700"
            >
              {sizeState.error}
            </p>
          )}
          <SectionSaveButton
            pending={sizeLoading}
            saved={sizeSaved}
          />
        </section>
      </form>
    </>
  );
}
