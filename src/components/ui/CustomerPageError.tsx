"use client";

import Link from "next/link";

export default function CustomerPageError({ reset, title = "This page could not load" }: { reset: () => void; title?: string }) {
  return <div role="alert" className="mx-auto max-w-xl px-6 py-20 text-center">
    <h1 className="font-heading text-[25px]">{title}</h1>
    <p className="mt-3 font-body text-[13px] text-muted">Please try again. If the problem continues, you can return to the marketplace.</p>
    <div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={reset} className="cta-primary">Try again</button><Link href="/shop" className="cta-secondary">Browse marketplace</Link></div>
  </div>;
}
