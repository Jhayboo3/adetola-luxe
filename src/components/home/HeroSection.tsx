import Link from "next/link";
import Image from "next/image";

export default function HeroSection() {
  return (
    <section className="mx-auto grid min-h-[82vh] max-w-[1440px] gap-6 px-4 pb-10 pt-5 md:grid-cols-[58%_42%] md:px-8 md:pb-16">
      <div className="relative overflow-hidden rounded-[28px] md:rounded-[36px]">
        <div className="aspect-[4/5] w-full md:aspect-auto md:h-full">
          <Image
            src="/hero-image.jpg"
            alt="Adetola Luxe"
            fill
            className="object-cover transition-transform duration-700 hover:scale-[1.02]"
            priority
            unoptimized
          />
        </div>
      </div>

      <div className="flex items-center rounded-[28px] bg-[#F5F0E9] px-8 py-16 md:rounded-[36px] md:px-12 lg:px-16">
        <div className="max-w-md">
          <div className="mb-6 h-[2px] w-16 bg-gold" />

          <p className="mb-2 font-body text-[11px] font-medium uppercase tracking-[2px] text-primary">
            The Archive
          </p>

          <h1 className="font-heading text-[48px] font-light leading-[1.1] tracking-tight text-black md:text-[56px] lg:text-[72px]">
            Adetola
            <br />
            Luxe
          </h1>

          <p className="mt-6 font-serif text-[18px] leading-relaxed text-muted">
            Cut from vision. Worn with intent.
          </p>

          <Link
            href="/shop"
            className="cta-primary mt-10"
          >
            Shop the Collection
          </Link>
        </div>
      </div>
    </section>
  );
}
