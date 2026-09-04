import Link from "next/link";
import Image from "next/image";

const shopLinks = [
  { href: "/shop", label: "Shop All" },
  { href: "/stores", label: "Marketplace Stores" },
  { href: "/search", label: "Search the Archive" },
  { href: "/sell", label: "Sell on Larkvine" },
];

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/services", label: "Our Services" },
];

const legalLinks = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/services", label: "Services & Dispute Resolution" },
];

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h4 className="mb-5 flex items-center gap-2 font-body text-[11px] font-semibold uppercase tracking-[2px] text-gold">
        <span className="h-[2px] w-5 bg-gold" />
        {title}
      </h4>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="group inline-flex items-center gap-1.5 font-body text-[13px] text-white/70 no-underline transition-colors hover:text-gold"
            >
              <span className="h-px w-0 bg-gold transition-all duration-300 group-hover:w-3" />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-[#0F2A22] text-white">
      <div className="mx-auto max-w-[1200px] px-8 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-3">
              <Image
                src="/brand-logo.png"
                alt="Larkvine"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
              <span className="font-heading text-2xl tracking-wide">Larkvine</span>
            </div>
            <p className="mt-5 font-serif text-[15px] italic leading-relaxed text-white/70">
              Found with vision. Bought with intent.
            </p>
            <p className="mt-4 max-w-sm font-body text-[12.5px] leading-relaxed text-white/55">
              A considered marketplace for wearable craft and curated goods.
              Every piece is chosen for the weight of its fabric, the precision
              of its seam, and the story it carries.
            </p>
          </div>

          {/* Shop */}
          <div className="md:col-span-2">
            <FooterColumn title="Shop" links={shopLinks} />
          </div>

          {/* Company */}
          <div className="md:col-span-2">
            <FooterColumn title="Company" links={companyLinks} />
          </div>

          {/* Legal */}
          <div className="md:col-span-2">
            <FooterColumn title="Legal" links={legalLinks} />
          </div>

          {/* Contact */}
          <div className="md:col-span-2">
            <h4 className="mb-5 flex items-center gap-2 font-body text-[11px] font-semibold uppercase tracking-[2px] text-gold">
              <span className="h-[2px] w-5 bg-gold" />
              Contact
            </h4>
            <div className="space-y-4">
              <a
                href="tel:+2348162141002"
                className="group flex items-start gap-2.5 font-body text-[13px] text-white/70 no-underline transition-colors hover:text-gold"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold transition-colors group-hover:bg-gold group-hover:text-[#0F2A22]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.9 2.2Z" /></svg>
                </span>
                <span>+234 816 214 1002</span>
              </a>
              <a
                href="mailto:jeremiahoshiokhame@gmail.com"
                className="group flex items-start gap-2.5 font-body text-[13px] text-white/70 no-underline transition-colors hover:text-gold"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold transition-colors group-hover:bg-gold group-hover:text-[#0F2A22]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></svg>
                </span>
                <span>jeremiahoshiokhame@gmail.com</span>
              </a>
            </div>
            <div className="mt-6 rounded-xl border border-gold/25 bg-gold/10 p-4">
              <p className="font-body text-[12px] leading-relaxed text-white/75">
                Any issues or delay with your vendor? Contact the administrator
                directly and we&apos;ll step in to resolve it.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-8 py-6 md:flex-row">
          <p className="font-body text-[11px] text-white/45">
            &copy; {2026} Larkvine. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/terms" className="font-body text-[11px] text-white/55 no-underline transition-colors hover:text-gold">
              Terms of Service
            </Link>
            <span className="hidden h-3 w-px bg-white/20 sm:inline-block" />
            <Link href="/privacy" className="font-body text-[11px] text-white/55 no-underline transition-colors hover:text-gold">
              Privacy Policy
            </Link>
            <span className="hidden h-3 w-px bg-white/20 sm:inline-block" />
            <Link href="/services" className="font-body text-[11px] text-white/55 no-underline transition-colors hover:text-gold">
              Services
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
