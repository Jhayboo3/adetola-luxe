import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
          <div>
            <div className="mb-4 h-[2px] w-12 bg-gold" />
            <h1 className="font-heading text-[28px] font-medium text-black">
              About Larkvine
            </h1>
            <div className="mt-8 space-y-6 font-serif text-[18px] leading-relaxed text-muted">
              <p>
                Larkvine is a contemporary fashion house rooted in a deep
                appreciation for craftsmanship, heritage, and the enduring power
                of form.
              </p>
              <p>
                Every piece in the Archive is thoughtfully considered — from the
                weight of a fabric to the precision of a seam. We believe in
                clothing that moves with you, that holds space, that becomes
                part of your story.
              </p>
              <p>
                Our collections are designed for those who see dressing as an
                act of intention. Not for the many, but for the discerning.
              </p>
            </div>
          </div>

          <div className="flex min-h-[520px] items-center justify-center overflow-hidden bg-[#0F2A22] p-12 md:min-h-[620px]">
            <Image
              src="/brand-logo.png"
              alt="Larkvine"
              width={360}
              height={360}
              className="h-auto w-full max-w-[360px] object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
