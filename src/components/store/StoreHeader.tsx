import Image from "next/image";

interface StoreHeaderProps {
  name: string;
  logo?: string | null;
}

// The store's public identity — its name (and logo, when provided) act as the
// branding header on its storefront page.
export default function StoreHeader({ name, logo }: StoreHeaderProps) {
  return (
    <div className="border-b border-line bg-[#FBF8F3]">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-8 py-14 text-center">
        {logo ? (
          <Image
            src={logo}
            alt={`${name} logo`}
            width={96}
            height={96}
            className="h-24 w-24 rounded-full border border-line object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
            <span className="font-heading text-[22px] leading-none">{name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <h1 className="font-heading text-[30px] font-medium text-black">{name}</h1>
        <p className="font-body text-[12px] uppercase tracking-[3px] text-muted">Storefront</p>
      </div>
    </div>
  );
}
