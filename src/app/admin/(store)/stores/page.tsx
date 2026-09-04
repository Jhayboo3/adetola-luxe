import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/store";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import { StoreManageActions } from "./manage-client";
import { StoreVerifyButton } from "./verify-client";

export const dynamic = "force-dynamic";

export default async function AllStoresPage() {
  await requirePlatformAdmin();

  const stores = await prisma.store.findMany({
    include: {
      owner: { select: { name: true, email: true, whatsapp: true, phone: true } },
      _count: { select: { products: true, orders: true, categories: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusLabel: Record<string, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    suspended: "Suspended",
  };
  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-700",
    suspended: "bg-slate-200 text-slate-700",
  };

  return (
    <div className="min-w-0">
      <div className="mb-8">
        <h1 className="font-heading text-[24px] font-medium">All Stores</h1>
        <p className="mt-1 font-body text-[13px] text-muted">
          Manage every store on the marketplace. Suspend to deactivate, or delete to remove permanently.
        </p>
      </div>

      <div className="border border-line">
        {stores.length === 0 && <p className="p-8 text-center font-body text-[13px] text-muted">No stores yet.</p>}
        {stores.map((store) => (
          <div key={store.id} className="flex flex-col gap-4 border-b border-line p-4 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-[16px]">{store.name}</h2>
                {store.isVerified && (
                  <VerifiedBadge size={16} />
                )}
                <span className={`rounded-full px-2 py-0.5 font-body text-[9px] font-bold uppercase tracking-[1px] ${statusColor[store.status] || "bg-slate-100"}`}>
                  {statusLabel[store.status] || store.status}
                </span>
              </div>
              <p className="mt-1 font-body text-[11px] text-muted">
                {store.owner.name} · {store.owner.email}
              </p>
              <p className="mt-0.5 font-body text-[11px] text-muted">
                {store._count.products} products · {store._count.orders} orders · {store._count.categories} categories · @{store.slug}
              </p>
              {store.status === "approved" && (
                <Link href={`/${store.slug}`} className="mt-1 inline-block font-body text-[11px] font-semibold text-primary underline underline-offset-4">
                  View storefront ↗
                </Link>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2">
              <StoreManageActions id={store.id} name={store.name} status={store.status} />
              <StoreVerifyButton id={store.id} name={store.name} verified={store.isVerified} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
