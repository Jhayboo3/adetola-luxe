import Image from "next/image";

type StoreInfo = {
  name: string;
  slug: string;
  logo: string | null;
  coverImage: string | null;
  isVerified: boolean;
  whatsapp?: string | null;
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

const DT = "font-body text-[10px] uppercase tracking-[1.5px] text-muted";
const DD = "mt-0.5 font-body text-[13px] break-words";
const BLOCK = "rounded-lg bg-[#F7F3ED] p-4";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className={DT}>{label}</dt>
      <dd className={DD}>{value}</dd>
    </div>
  );
}

export default function StoreDetailDisplay({ store }: { store: StoreInfo }) {
  const location = [store.city, store.state, store.country].filter(Boolean).join(", ");
  const about = store.aboutStore || store.description;

  return (
    <div className="space-y-4">
      {/* Images + verified */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {store.coverImage && (
          <Image src={store.coverImage} alt={`${store.name} cover`} width={320} height={120} className="aspect-video w-full max-w-xs rounded-xl border border-line object-cover" unoptimized />
        )}
        <div className="flex items-center gap-3">
          {store.logo ? (
            <Image src={store.logo} alt={`${store.name} logo`} width={64} height={64} className="h-16 w-16 rounded-full border border-line object-cover" unoptimized />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
              <span className="font-heading text-[20px]">{store.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-[15px]">{store.name}</span>
              {store.isVerified && (
                <span title="Verified" className="inline-flex items-center justify-center rounded-full bg-[#1DA1F2] p-0.5 text-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
              )}
            </div>
            <p className="font-body text-[11px] text-muted">@{store.slug}</p>
          </div>
        </div>
      </div>

      {about && <div className={BLOCK}><p className="font-body text-[12px] leading-relaxed text-ink/80">{about}</p></div>}

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Category" value={store.category} />
        <Field label="Description" value={store.description} />
        {location && <Field label="Location" value={location} />}
        <Field label="Area" value={store.area} />
        <Field label="Physical Address" value={store.physicalAddress} />
        <Field label="Map Location" value={store.mapLocation} />
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Phone" value={store.phone} />
        <Field label="Email" value={store.email} />
        <Field label="Instagram" value={store.instagramUrl} />
        <Field label="Preferred Contact" value={store.preferredContactMethod} />
        <Field label="Opening Hours" value={store.openingHours} />
        <Field label="Delivery Areas" value={store.deliveryAreas} />
      </div>

      {(store.pickupAvailable || store.deliveryAvailable) && (
        <div className="flex flex-wrap gap-2">
          {store.pickupAvailable && (
            <span className="rounded-full bg-[#005C29]/10 px-3 py-1 font-body text-[11px] font-medium text-[#005C29]">Pickup available</span>
          )}
          {store.deliveryAvailable && (
            <span className="rounded-full bg-[#005C29]/10 px-3 py-1 font-body text-[11px] font-medium text-[#005C29]">Delivery available</span>
          )}
        </div>
      )}

      {store.productsDescription && (
        <div className={BLOCK}><dt className={DT}>What they sell</dt><p className="mt-1 font-body text-[12px] leading-relaxed text-ink/80">{store.productsDescription}</p></div>
      )}
      {store.pickupInformation && (
        <div className={BLOCK}><dt className={DT}>Pickup information</dt><p className="mt-1 font-body text-[12px] leading-relaxed text-ink/80">{store.pickupInformation}</p></div>
      )}
      {store.paymentMethods && (
        <div className={BLOCK}><dt className={DT}>Payment methods</dt><p className="mt-1 font-body text-[12px] leading-relaxed text-ink/80">{store.paymentMethods}</p></div>
      )}
      {store.returnPolicy && (
        <div className={BLOCK}><dt className={DT}>Return / exchange policy</dt><p className="mt-1 font-body text-[12px] leading-relaxed text-ink/80">{store.returnPolicy}</p></div>
      )}
    </div>
  );
}
