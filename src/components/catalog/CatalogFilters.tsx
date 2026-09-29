import Link from "next/link";
import { koboToNaira } from "@/lib/money";
import type { CatalogParams } from "@/lib/catalog";

type Category = { id: string; name: string; store: { name: string } };
type Store = { name: string; slug: string };

function Fields({ filters, categories, stores }: { filters: CatalogParams; categories: Category[]; stores: Store[] }) {
  const field = "mt-1 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return <>
    <label className="text-[12px] text-muted">Search<input name="q" type="search" defaultValue={filters.q} placeholder="Products, stores, categories" className={field} /></label>
    <label className="text-[12px] text-muted">Store<select name="store" defaultValue={filters.store} className={field}><option value="">All stores</option>{stores.map((store) => <option key={store.slug} value={store.slug}>{store.name}</option>)}</select></label>
    <label className="text-[12px] text-muted">Store category<select name="category" defaultValue={filters.category} className={field}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.store.name} / {category.name}</option>)}</select></label>
    <label className="text-[12px] text-muted">Sort<select name="sort" defaultValue={filters.sort} className={field}><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label>
    <label className="text-[12px] text-muted">Minimum price (₦)<input name="minPrice" inputMode="decimal" defaultValue={filters.minPriceMinor == null ? "" : String(koboToNaira(filters.minPriceMinor))} className={field} /></label>
    <label className="text-[12px] text-muted">Maximum price (₦)<input name="maxPrice" inputMode="decimal" defaultValue={filters.maxPriceMinor == null ? "" : String(koboToNaira(filters.maxPriceMinor))} className={field} /></label>
    <div className="flex items-end gap-3 sm:col-span-2"><button className="cta-primary min-h-11 px-6">Apply filters</button><Link href="/shop" className="py-3 text-[12px] text-muted underline">Clear all</Link></div>
  </>;
}

export default function CatalogFilters({ filters, categories, stores }: { filters: CatalogParams; categories: Category[]; stores: Store[] }) {
  const active = [filters.q, filters.store, filters.category, filters.minPriceMinor != null ? "min price" : "", filters.maxPriceMinor != null ? "max price" : "", filters.sort !== "newest" ? filters.sort : ""].filter(Boolean).length;
  return <>
    <details className="mt-6 rounded-xl border border-line lg:hidden">
      <summary className="min-h-12 cursor-pointer px-4 py-3 font-body text-[13px] font-semibold">Filter and sort{active ? ` · ${active} active` : ""}</summary>
      <form action="/shop" className="grid gap-4 border-t border-line p-4 sm:grid-cols-2"><Fields filters={filters} categories={categories} stores={stores} /></form>
    </details>
    <form action="/shop" className="mt-8 hidden gap-3 rounded-xl border border-line p-4 lg:grid lg:grid-cols-4"><Fields filters={filters} categories={categories} stores={stores} /></form>
    {active > 0 && <div className="mt-3 flex items-center gap-3 font-body text-[12px] text-muted"><span>{active} active filter{active === 1 ? "" : "s"}</span><Link href="/shop" className="font-semibold text-primary underline">Clear all</Link></div>}
  </>;
}
