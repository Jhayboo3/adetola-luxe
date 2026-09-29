import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import VerifiedBadge from "@/components/ui/VerifiedBadge";


async function StoresContent({ page }: { page: number }) {
  await connection();
  const rows = await prisma.store.findMany({
    where: { status: "approved" },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * 24,
    take: 25,
    include: { _count: { select: { products: { where: { published: true, stock: { gt: 0 } } } } } },
  });
  const hasNext = rows.length > 24;
  const stores = rows.slice(0, 24);

  return (
    <div className="py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="mb-4 h-[2px] w-12 bg-gold" />
        <h1 className="font-heading text-[28px] font-medium text-black">Marketplace Stores</h1>
        <p className="mt-2 font-body text-[13px] text-muted">
          Browse approved vendors on Larkvine. Showing {stores.length} stores on page {page}.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/${store.slug}`}
              className="group flex flex-col rounded-[24px] border border-line bg-white p-6 no-underline transition-shadow hover:shadow-[0_12px_40px_rgba(15,42,34,0.08)]"
            >
              <div className="flex items-center gap-4">
                {store.logo ? (
                  <Image src={store.logo} alt={`${store.name} logo`} width={56} height={56} className="h-14 w-14 rounded-full border border-line object-cover" unoptimized />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white">
                    <span className="font-heading text-[20px] leading-none">{store.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate font-heading text-[17px] font-medium text-black">{store.name}</h2>
                    {store.isVerified && (
                      <VerifiedBadge size={15} />
                    )}
                  </div>
                  <p className="font-body text-[11px] uppercase tracking-[2px] text-muted">Store</p>
                </div>
              </div>
              {store.description && <p className="mt-4 line-clamp-2 font-body text-[12px] leading-relaxed text-muted">{store.description}</p>}
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <span className="font-body text-[11px] text-muted">{store._count.products} products</span>
                <span className="font-body text-[11px] font-semibold uppercase tracking-[2px] text-primary transition-colors group-hover:text-primary-light">Visit →</span>
              </div>
            </Link>
          ))}
        </div>

        {stores.length === 0 && (
          <div className="mt-10 border border-dashed border-line py-16 text-center">
            <p className="font-heading text-[18px] text-black">No stores yet</p>
            <p className="mt-2 font-body text-[13px] text-muted">There are no stores to browse right now. Check back soon or browse available products.</p>
            <Link href="/shop" className="cta-primary mt-6 inline-flex">Browse products</Link>
          </div>
        )}
        <nav aria-label="Store directory pages" className="mt-10 flex justify-between gap-4">{page > 1 ? <Link href={`/stores?page=${page - 1}`} className="cta-secondary px-5 py-3">Previous</Link> : <span />}{hasNext && <Link href={`/stores?page=${page + 1}`} className="cta-secondary px-5 py-3">Next</Link>}</nav>
      </div>
    </div>
  );
}

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const raw = (await searchParams).page;
  const parsed = typeof raw === "string" ? Number(raw) : 1;
  const page = Number.isSafeInteger(parsed) ? Math.min(1000, Math.max(1, parsed)) : 1;
  return (
    <Suspense fallback={null}>
      <StoresContent page={page} />
    </Suspense>
  );
}
