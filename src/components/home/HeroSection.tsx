import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="px-4 pb-6 pt-4 sm:px-8 md:pb-10">
      <div className="mx-auto max-w-[1200px] rounded-2xl bg-[#0F2A22] px-6 py-10 text-white sm:px-10 md:py-14">
        <div className="max-w-2xl">
          <p className="font-body text-[11px] font-semibold uppercase tracking-[2px] text-gold">The Larkvine marketplace</p>
          <h1 className="mt-3 font-heading text-[32px] font-medium leading-tight sm:text-[40px] md:text-[46px]">Find something worth keeping.</h1>
          <p className="mt-4 max-w-xl font-body text-[14px] leading-relaxed text-white/85">Discover products from independent stores in one place. Browse by product or visit a seller&apos;s storefront.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/shop" className="cta-primary">Browse marketplace</Link>
            <Link href="/stores" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/60 px-7 py-3 font-body text-[12px] font-bold uppercase tracking-[1px] text-white no-underline transition-colors hover:border-gold hover:bg-gold hover:text-black">Browse stores</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
