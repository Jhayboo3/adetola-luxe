import Link from "next/link";
import Image from "next/image";

export interface HeroStore {
  name: string;
  slug: string;
  logo?: string | null;
}

export default function HeroSection({
  storeCount,
  productCount,
  stores,
}: {
  storeCount: number;
  productCount: number;
  stores?: HeroStore[];
}) {
  const avatars = (stores ?? []).slice(0, 5);
  const overflow = (stores?.length ?? 0) - avatars.length;

  return (
    <section className="px-4 pb-8 pt-4 md:px-8">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-[#0A241C] px-6 py-16 text-center text-white shadow-[0_30px_80px_rgba(10,36,28,0.35)] md:rounded-[36px] md:py-24">
        {/* Ambient gradient glows */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/50 blur-3xl animate-float-slower" />
          <div className="absolute -right-20 top-6 h-80 w-80 rounded-full bg-gold/25 blur-3xl animate-float-slow" />
          <div className="absolute -bottom-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute right-1/4 top-1/2 h-40 w-40 rounded-full bg-gold/15 blur-2xl animate-float-slow" style={{ animationDelay: "2s" }} />
        </div>

        {/* Subtle diagonal line texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 1px, transparent 24px)",
          }}
        />

        {/* Soft top highlight */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent" />

        <div className="relative">
          <h1 className="animate-fade-up font-heading text-[34px] font-light leading-[1.1] tracking-tight md:text-[52px]" style={{ animationDelay: "80ms" }}>
            One marketplace.<br />
            <span className="bg-gradient-to-r from-gold-light via-gold to-gold-light bg-clip-text font-normal text-transparent">Every store you love.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up font-serif text-[17px] leading-relaxed text-white/85 md:text-[19px]" style={{ animationDelay: "160ms" }}>
            Larkvine is a multi-vendor marketplace where independent stores list and sell
            their products — browse fresh arrivals from every seller in one place.
          </p>

          {/* Marketplace stats */}
          <div className="mt-9 flex animate-fade-up flex-wrap items-center justify-center gap-x-8 gap-y-4" style={{ animationDelay: "260ms" }}>
            <div className="flex items-center gap-3">
              <span className="font-heading text-[30px] font-medium leading-none text-gold md:text-[36px]">{storeCount}</span>
              <span className="text-left font-body text-[11px] font-semibold uppercase leading-tight tracking-[2px] text-white/70">{storeCount === 1 ? "Store" : "Stores"}<br />live now</span>
            </div>
            <span aria-hidden="true" className="hidden h-10 w-px bg-white/20 sm:block" />
            <div className="flex items-center gap-3">
              <span className="font-heading text-[30px] font-medium leading-none text-gold md:text-[36px]">{productCount}</span>
              <span className="text-left font-body text-[11px] font-semibold uppercase leading-tight tracking-[2px] text-white/70">{productCount === 1 ? "Product" : "Products"}<br />to discover</span>
            </div>
          </div>

          {/* Store avatars strip */}
          {avatars.length > 0 && (
            <div className="mt-9 flex animate-fade-up flex-col items-center gap-3" style={{ animationDelay: "340ms" }}>
              <div className="flex items-center">
                <div className="flex -space-x-3">
                  {avatars.map((store) => (
                    <Link key={store.slug} href={`/${store.slug}`} aria-label={store.name} className="block h-11 w-11 overflow-hidden rounded-full border-2 border-[#0A241C] transition-transform hover:z-10 hover:-translate-y-1">
                      {store.logo ? (
                        <Image src={store.logo} alt="" width={44} height={44} className="h-11 w-11 object-cover" unoptimized />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-light to-primary font-heading text-[16px] text-white">
                          {store.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
                {overflow > 0 && (
                  <span className="z-[2] -ml-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#0A241C] bg-black font-heading text-[13px] text-white">
                    +{overflow}
                  </span>
                )}
              </div>
              <p className="font-body text-[11px] uppercase tracking-[2px] text-white/60">Fresh from the stores above</p>
            </div>
          )}

          <div className="mt-10 flex animate-fade-up flex-wrap items-center justify-center gap-3" style={{ animationDelay: "420ms" }}>
            <Link href="/shop" className="cta-primary">Shop All</Link>
            <Link href="/stores" className="rounded-full border-2 border-gold bg-white/5 px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[1.2px] text-gold no-underline transition-all hover:-translate-y-0.5 hover:bg-gold hover:text-black">Browse Stores</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
