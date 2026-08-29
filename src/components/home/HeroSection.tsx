import Link from "next/link";

export default function HeroSection({ storeCount, productCount }: { storeCount: number; productCount: number }) {
  return (
    <section className="px-4 pb-8 pt-4 md:px-8">
      <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-[#0F2A22] px-8 py-16 text-center text-white md:rounded-[36px] md:py-24">
        <div className="mx-auto mb-6 h-[2px] w-16 bg-gold" />
        <h1 className="font-heading text-[34px] font-light leading-[1.1] tracking-tight md:text-[52px]">
          One marketplace.<br />Every store you love.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl font-serif text-[17px] leading-relaxed text-white/80 md:text-[19px]">
          Larkvine is a multi-vendor marketplace where independent stores list and sell
          their products — browse fresh arrivals from every seller in one place.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <span className="rounded-full bg-white/10 px-5 py-2 font-body text-[11px] font-semibold uppercase tracking-[2px]">
            {storeCount} {storeCount === 1 ? "Store" : "Stores"}
          </span>
          <span className="rounded-full bg-white/10 px-5 py-2 font-body text-[11px] font-semibold uppercase tracking-[2px]">
            {productCount} {productCount === 1 ? "Product" : "Products"}
          </span>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/shop" className="cta-primary">Shop All</Link>
          <Link href="/stores" className="rounded-full border-2 border-gold px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[1.2px] text-gold no-underline transition-colors hover:bg-gold hover:text-black">Browse Stores</Link>
        </div>
      </div>
    </section>
  );
}
