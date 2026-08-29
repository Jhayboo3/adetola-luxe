import Link from "next/link";

export default function EditorialNote() {
  return (
    <section className="px-4 py-12 md:px-8 md:py-20">
      <div className="mx-auto max-w-[900px] rounded-[32px] bg-[#0F2A22] px-8 py-20 text-center md:rounded-[44px] md:px-20 md:py-24">
        <div className="mx-auto mb-8 h-[2px] w-16 bg-gold" />

        <p className="font-serif text-[20px] leading-relaxed text-white/85 md:text-[24px]">
          &ldquo;Each piece in the Larkvine Archive is a study in form, fabric,
          and feeling. Cut from vision. Worn with intent.&rdquo;
        </p>

        <Link
          href="/about"
          className="cta-secondary mt-10 border-gold text-gold hover:bg-gold hover:text-black"
        >
          Our Story
        </Link>
      </div>
    </section>
  );
}
