import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/store";
import StoreDetailDisplay from "@/components/admin/StoreDetailDisplay";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import { ApplicationActions } from "./actions-client";
import { StoreVerifyButton } from "../stores/verify-client";

export const dynamic = "force-dynamic";

export default async function StoreApplicationsPage() {
  await requirePlatformAdmin();

  const applications = await prisma.store.findMany({
    include: {
      owner: { select: { name: true, email: true, whatsapp: true, phone: true, createdAt: true } },
      _count: { select: { products: true, orders: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusOrder = ["pending", "rejected", "approved", "suspended"];
  const sorted = [...applications].sort(
    (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status),
  );

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
        <h1 className="font-heading text-[24px] font-medium">Store Applications</h1>
        <p className="mt-1 font-body text-[13px] text-muted">
          Review seller applications. Approved stores go live immediately.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        {Object.entries(statusLabel).map(([key, label]) => {
          const n = applications.filter((a) => a.status === key).length;
          return (
            <div key={key} className="min-w-[140px] border border-line p-4">
              <p className="font-body text-[10px] uppercase tracking-[2px] text-muted">{label}</p>
              <p className="mt-1 font-heading text-[20px]">{n}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 space-y-4">
        {sorted.length === 0 && (
          <p className="rounded-xl border border-line p-8 text-center font-body text-[13px] text-muted">No store applications yet.</p>
        )}
        {sorted.map((app) => (
          <div key={app.id} className="border border-line p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="font-heading text-[18px]">{app.name}</h2>
                  <span className={`rounded-full px-2.5 py-1 font-body text-[10px] font-bold uppercase tracking-[1px] ${statusColor[app.status] || "bg-slate-100 text-slate-600"}`}>
                    {statusLabel[app.status] || app.status}
                  </span>
                </div>
                <p className="mt-1 font-body text-[11px] text-muted">@{app.slug} · Applied {new Date(app.createdAt).toLocaleDateString()}</p>
                {app.status === "approved" && app.approvedAt && (
                  <p className="mt-0.5 font-body text-[11px] text-muted">Approved {new Date(app.approvedAt).toLocaleDateString()}</p>
                )}
              </div>
              {app.status === "approved" && (
                <Link href={`/${app.slug}`} className="shrink-0 font-body text-[11px] font-semibold text-primary underline underline-offset-4">
                  View storefront ↗
                </Link>
              )}
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <StoreDetailDisplay store={app} />
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="font-body text-[10px] uppercase tracking-[1.5px] text-muted">Owner</dt>
                <dd className="font-body">{app.owner.name}</dd>
              </div>
              <div>
                <dt className="font-body text-[10px] uppercase tracking-[1.5px] text-muted">Owner Email</dt>
                <dd className="break-all font-body">{app.owner.email}</dd>
              </div>
              <div>
                <dt className="font-body text-[10px] uppercase tracking-[1.5px] text-muted">WhatsApp / Phone</dt>
                <dd className="font-body">{app.whatsapp || app.phone || app.owner.whatsapp || app.owner.phone || "—"}</dd>
              </div>
              <div>
                <dt className="font-body text-[10px] uppercase tracking-[1.5px] text-muted">Products / Orders</dt>
                <dd className="font-body">
                  {app._count.products} products · {app._count.orders} orders
                </dd>
              </div>
            </dl>

            {app.status === "rejected" && app.rejectionReason && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 font-body text-[12px] text-red-700">
                <span className="font-semibold">Rejection reason:</span> {app.rejectionReason}
              </p>
            )}

            <div className="mt-5 border-t border-line pt-4">
              <ApplicationActions id={app.id} name={app.name} showApprove={app.status !== "approved"} />
              <div className="mt-3 flex items-center gap-3">
                <StoreVerifyButton id={app.id} name={app.name} verified={app.isVerified} />
                {app.isVerified && (
                  <span className="inline-flex items-center gap-1.5 font-body text-[11px] font-medium text-[#1D9BF0]">
                    <VerifiedBadge size={16} />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
