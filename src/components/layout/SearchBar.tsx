"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/utils";

interface SuggestionProduct { id: string; name: string; slug: string; price: number; image: string | null; store: { slug: string; name: string } }
interface SuggestionStore { id: string; name: string; slug: string; logo: string | null }
interface SuggestionCategory { slug: string; name: string; store: { slug: string } }

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ products: SuggestionProduct[]; stores: SuggestionStore[]; categories: SuggestionCategory[] }>({ products: [], stores: [], categories: [] });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) return;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults({ products: [], stores: [], categories: [] });
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults({ products: [], stores: [], categories: [] });
      setLoading(false);
    }
  };

  const submit = (value?: string) => {
    const term = (value ?? query).trim();
    setOpen(false);
    setQuery("");
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
    else router.push("/search");
  };

  const hasResults = results.products.length + results.stores.length + results.categories.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search the marketplace"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-black transition-colors hover:border-primary hover:text-primary"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[95]" role="presentation">
          <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-black/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-label="Close search" />
          <div className="absolute inset-x-0 top-0 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Search the marketplace">
            <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
              <div className="flex items-center gap-3">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-black" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
                  placeholder="Search products, stores, categories..."
                  className="min-w-0 flex-1 bg-transparent font-heading text-[20px] text-black outline-none placeholder:text-line sm:text-[24px]"
                />
                <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-line text-xl transition-colors hover:border-primary hover:text-primary">×</button>
              </div>

              {query.trim() && (
                <div className="mt-5 grid gap-6 border-t border-line pt-5 md:grid-cols-3">
                  <div>
                    <p className="mb-3 font-body text-[10px] font-bold uppercase tracking-[2px] text-muted">Products</p>
                    <div className="space-y-1">
                      {results.products.map((p) => (
                        <Link key={p.id} href={`/${p.store.slug}/${p.slug}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-2 no-underline transition-colors hover:bg-[#F5F0E9]">
                          {p.image ? <Image src={p.image} alt="" width={40} height={40} className="h-10 w-10 rounded-lg object-cover" unoptimized /> : <div className="h-10 w-10 rounded-lg bg-line" />}
                          <span className="min-w-0">
                            <span className="block truncate font-heading text-[13px] text-black">{p.name}</span>
                            <span className="block font-body text-[11px] text-muted">{formatPrice(p.price)} · {p.store.name}</span>
                          </span>
                        </Link>
                      ))}
                      {!loading && results.products.length === 0 && <p className="px-2 font-body text-[12px] text-muted">No product matches.</p>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 font-body text-[10px] font-bold uppercase tracking-[2px] text-muted">Stores</p>
                    <div className="space-y-1">
                      {results.stores.map((s) => (
                        <Link key={s.id} href={`/${s.slug}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-2 no-underline transition-colors hover:bg-[#F5F0E9]">
                          {s.logo ? <Image src={s.logo} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" unoptimized /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white"><span className="font-heading text-[14px]">{s.name.charAt(0).toUpperCase()}</span></div>}
                          <span className="font-heading text-[13px] text-black">{s.name}</span>
                        </Link>
                      ))}
                      {!loading && results.stores.length === 0 && <p className="px-2 font-body text-[12px] text-muted">No store matches.</p>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 font-body text-[10px] font-bold uppercase tracking-[2px] text-muted">Categories</p>
                    <div className="space-y-1">
                      {results.categories.map((c, i) => (
                        <Link key={`${c.store.slug}-${c.slug}-${i}`} href={`/${c.store.slug}`} onClick={() => setOpen(false)} className="block rounded-xl p-2 font-heading text-[13px] text-black no-underline transition-colors hover:bg-[#F5F0E9]">
                          {c.name}
                        </Link>
                      ))}
                      {!loading && results.categories.length === 0 && <p className="px-2 font-body text-[12px] text-muted">No category matches.</p>}
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <button type="button" onClick={() => submit()} className="cta-primary w-full">View all results for “{query}”</button>
                  </div>
                </div>
              )}
              {loading && <p className="mt-4 font-body text-[12px] text-muted">Searching…</p>}
              {hasResults === false && query.trim() && !loading && (
                <p className="mt-5 border-t border-line pt-5 font-body text-[13px] text-muted">No matches found. Press Enter to search the full marketplace.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
