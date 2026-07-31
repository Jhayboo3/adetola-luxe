import Link from "next/link";
import Image from "next/image";

export default function FeaturedCollections({ collections }: { collections: { name: string; slug: string; image: string | null }[] }) {
  return (
    <section className="rounded-[32px] bg-[#F7F3ED] py-20 md:mx-4 md:rounded-[44px] md:py-24">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-12">
          <div className="mb-4 h-[2px] w-12 bg-gold" />
          <h2 className="font-heading text-[28px] font-medium text-black">
            Collections
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {collections.map((col) => (
            <Link
              key={col.slug}
              href={`/shop?category=${col.slug}`}
              className="group relative block aspect-[3/4] w-full overflow-hidden rounded-[24px] bg-line no-underline shadow-[0_12px_40px_rgba(15,42,34,0.08)] md:rounded-[30px]"
            >
              {col.image ? <Image src={col.image} alt={col.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" unoptimized /> : <div className="flex h-full w-full items-center justify-center bg-[#E5DDD3] transition-transform duration-500 group-hover:scale-[1.02]">
                <span className="font-body text-[11px] uppercase tracking-[2px] text-muted">
                  {col.name}
                </span>
              </div>}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                <h3 className="font-heading text-lg text-white">
                  {col.name}
                </h3>
                <p className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 font-body text-[10px] uppercase tracking-[2px] text-gold backdrop-blur-sm">
                  Explore
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
