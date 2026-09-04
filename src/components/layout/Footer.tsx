"use client";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-8 py-16 md:grid-cols-3">
        <div>
          <h3 className="font-heading text-lg text-black">Larkvine</h3>
          <p className="mt-2 font-body text-[13px] leading-relaxed text-muted">
            Found with vision. Bought with intent.
          </p>
        </div>

        <div>
          <h4 className="mb-4 font-body text-[11px] font-medium uppercase tracking-[2px] text-black">
            Contact
          </h4>
          <div className="flex flex-col gap-2 font-body text-[13px] text-muted">
            <a
              href="tel:+2347011033320"
              className="text-muted no-underline transition-colors hover:text-primary"
            >
              07011033320
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto max-w-[1200px] px-8 py-6 text-center">
          <p className="font-body text-[11px] text-muted">
            &copy; {2026} Larkvine. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
