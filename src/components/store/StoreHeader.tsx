import Image from "next/image";

interface StoreHeaderProps {
  name: string;
  logo?: string | null;
  coverImage?: string | null;
  description?: string | null;
  isVerified?: boolean;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  email?: string | null;
  instagramUrl?: string | null;
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
}

function normalizeWhatsapp(w: string | null | undefined): string | null {
  const digits = (w ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("0") ? digits.slice(0, 0) + "234" + digits.slice(1) : digits;
}

function truncated(value: string | null | undefined, chars: number): string {
  const v = value?.trim() ?? "";
  if (!v) return "";
  return v.length > chars ? v.slice(0, chars).trimEnd() + "…" : v;
}

// The store's public identity — name, logo, cover banner, verification badge,
// description and a privacy-conscious location. Contact details are only shown
// when the seller actually provided them.
export default function StoreHeader(props: StoreHeaderProps) {
  const location = [props.city, props.state, props.country].filter(Boolean).join(", ");
  const waLink = normalizeWhatsapp(props.whatsapp);

  return (
    <div className="border-b border-line bg-[#FBF8F3]">
      {props.coverImage && (
        <div className="h-40 w-full overflow-hidden md:h-56">
          <Image src={props.coverImage} alt={`${props.name} cover`} width={1600} height={400} className="h-full w-full object-cover" unoptimized />
        </div>
      )}
      <div className="mx-auto max-w-[1200px] px-8">
        <div className={`flex flex-col items-center text-center ${props.coverImage ? "-mt-12 pb-6" : "py-14"}`}>
          <div className="relative">
            {props.logo ? (
              <Image
                src={props.logo}
                alt={`${props.name} logo`}
                width={88}
                height={88}
                className="rounded-full border-4 border-white bg-white object-cover shadow-[0_4px_20px_rgba(15,42,34,0.12)] h-20 w-20 md:h-24 md:w-24"
                unoptimized
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-black text-white shadow-[0_4px_20px_rgba(15,42,34,0.12)] md:h-24 md:w-24">
                <span className="font-heading text-[24px] leading-none">{props.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            {props.isVerified && (
              <span title="Verified store" className="absolute -bottom-0.5 right-0 flex items-center justify-center rounded-full bg-[#1DA1F2] p-1 text-white shadow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <h1 className="font-heading text-[28px] font-medium text-black md:text-[32px]">{props.name}</h1>
          </div>

          {props.description && (
            <p className="mx-auto mt-2 max-w-2xl font-body text-[13px] leading-relaxed text-muted">{truncated(props.description, 220)}</p>
          )}

          {location && (
            <p className="mt-3 inline-flex items-center gap-1.5 font-body text-[13px] text-muted">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              {location}
            </p>
          )}

          {(props.pickupAvailable || props.deliveryAvailable) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {props.pickupAvailable && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#005C29]/10 px-3 py-1 font-body text-[11px] font-medium text-[#005C29]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                  Pickup available
                </span>
              )}
              {props.deliveryAvailable && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#005C29]/10 px-3 py-1 font-body text-[11px] font-medium text-[#005C29]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14M5 17a2 2 0 1 1-2-2M5 17a2 2 0 1 0 2 2M21 17h-2M21 17a2 2 0 1 1-2-2m2 2a2 2 0 1 0-2-2m-2-8h4l3 5v3h-7V7Z"/><path d="M13 7H3v10h2"/></svg>
                  Delivery available
                </span>
              )}
            </div>
          )}

          {(waLink || props.phone || props.email || props.instagramUrl) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {waLink && (
                <a
                  href={`https://wa.me/${waLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 font-body text-[12px] font-bold text-white no-underline transition-transform hover:-translate-y-0.5"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.13c-.24.68-1.4 1.3-1.93 1.35-.52.05-1.02.24-3.42-.71-2.89-1.14-4.73-4.07-4.88-4.26-.14-.19-1.16-1.55-1.16-2.96 0-1.41.74-2.1 1-2.39.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.65.49.24.57.82 1.99.89 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.3.38-.42.51-.14.14-.29.3-.12.58.17.29.75 1.24 1.61 2.01 1.11.98 2.04 1.29 2.33 1.43.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.64-.14.26.09 1.65.78 1.93.92.29.14.48.21.55.33.07.12.07.68-.17 1.35Z"/></svg>
                  Contact on WhatsApp
                </a>
              )}
              {props.phone && (
                <a href={`tel:${props.phone}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 font-body text-[12px] font-semibold text-black no-underline transition-colors hover:border-primary hover:text-primary">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>
                  Call
                </a>
              )}
              {props.email && (
                <a href={`mailto:${props.email}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 font-body text-[12px] font-semibold text-black no-underline transition-colors hover:border-primary hover:text-primary">
                  Email
                </a>
              )}
              {props.instagramUrl && (
                <a href={props.instagramUrl.startsWith("http") ? props.instagramUrl : `https://instagram.com/${props.instagramUrl.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 font-body text-[12px] font-semibold text-black no-underline transition-colors hover:border-primary hover:text-primary">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                  Instagram
                </a>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
