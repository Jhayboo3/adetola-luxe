import type { ReactNode } from "react";
import Link from "next/link";

export type LegalSection = {
  id: string;
  heading: string;
  body: ReactNode;
};

export function LegalHero({
  eyebrow,
  title,
  intro,
  updated,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
}) {
  return (
    <div className="bg-[#0F2A22] text-white">
      <div className="mx-auto max-w-[1200px] px-8 py-16 md:py-20">
        <p className="font-body text-[11px] font-semibold uppercase tracking-[3px] text-gold">{eyebrow}</p>
        <h1 className="mt-3 font-heading text-[26px] font-medium md:text-[34px]">{title}</h1>
        <p className="mt-4 max-w-2xl font-body text-[13.5px] leading-relaxed text-white/70">{intro}</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          <span className="font-body text-[11px] text-gold">Last updated: {updated}</span>
        </div>
      </div>
    </div>
  );
}

function LegalDocument({
  title,
  sections,
  updated,
}: {
  title: string;
  sections: LegalSection[];
  updated: string;
}) {
  return (
    <div className="mx-auto max-w-[1200px] px-8 py-14">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
        {/* Table of contents */}
        <aside className="md:col-span-3">
          <div className="sticky top-24 rounded-2xl border border-line bg-white p-6">
            <p className="mb-4 font-body text-[11px] font-semibold uppercase tracking-[2px] text-muted">
              On this page
            </p>
            <nav className="space-y-3">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block border-l-2 border-line pl-3 font-body text-[12.5px] leading-snug text-muted no-underline transition-colors hover:border-gold hover:text-black"
                >
                  {s.heading}
                </a>
              ))}
            </nav>
            <div className="mt-6 border-t border-line pt-4">
              <p className="font-body text-[11px] leading-relaxed text-muted">
                Questions about this document? Email{" "}
                <a
                  href="mailto:jeremiahoshiokhame@gmail.com"
                  className="text-primary no-underline hover:text-primary-light"
                >
                  jeremiahoshiokhame@gmail.com
                </a>
                , or find the administrator&apos;s number in the site footer.
              </p>
            </div>
          </div>
        </aside>

        {/* Document body */}
        <div className="md:col-span-9">
          <div className="space-y-12">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-[2px] w-8 bg-gold" />
                  <h2 className="font-heading text-[22px] font-medium text-black">{s.heading}</h2>
                </div>
                <div className="space-y-4 font-body text-[13.5px] leading-relaxed text-muted">
                  {s.body}
                </div>
              </section>
            ))}
          </div>

          {/* Footer/contact bar */}
          <div className="mt-14 rounded-2xl border border-line bg-white p-8">
            <h3 className="font-heading text-[18px] font-medium text-black">{title}</h3>
            <p className="mt-2 font-body text-[12.5px] text-muted">
              This document was last updated on {updated}. By continuing to use
              Larkvine, you agree to the terms described above.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:jeremiahoshiokhame@gmail.com"
                className="cta-primary inline-flex min-h-11 items-center justify-center px-6 text-[12px]"
              >
                Email the Administrator
              </a>
              <Link
                href="/contact"
                className="cta-secondary inline-flex min-h-11 items-center justify-center px-6 text-[12px]"
              >
                Get in Touch
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="bg-[#FBF9F4]">
      <LegalHero eyebrow={eyebrow} title={title} intro={intro} updated={updated} />
      <LegalDocument title={title} sections={sections} updated={updated} />
    </div>
  );
}
