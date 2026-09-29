export default function CatalogLoading({ title }: { title: string }) {
  return <div role="status" aria-live="polite" className="mx-auto max-w-[1200px] px-6 py-12 sm:px-8">
    <h1 className="font-heading text-[26px]">{title}</h1>
    <p className="mt-2 font-body text-[13px] text-muted">Loading available products and stores…</p>
    <div aria-hidden="true" className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => <div key={index} className="animate-pulse"><div className="aspect-[3/4] rounded-xl bg-line" /><div className="mt-3 h-4 w-4/5 rounded bg-line" /><div className="mt-2 h-3 w-2/5 rounded bg-line" /></div>)}
    </div>
  </div>;
}
