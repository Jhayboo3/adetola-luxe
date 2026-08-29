import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STORE_STATUSES, isSuperAdminRole } from "@/lib/store";
import { PendingStoreNotice } from "../pending-notice";

export const dynamic = "force-dynamic";

export default async function AdminStoreLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  // A pending/rejected vendor must not reach any store management page. Show a
  // clear notice until a super admin approves (or the application is rejected).
  if (session?.user && role === "vendor") {
    const store = await prisma.store.findFirst({ where: { ownerId: session.user.id } });
    if (store && store.status !== STORE_STATUSES.approved) {
      return (
        <div className="min-h-screen bg-white">
          <div className="border-b border-line bg-[#F7F3ED]"><div className="mx-auto flex min-h-14 max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:px-6 md:px-8"><div><p className="font-heading text-[17px] text-black">Larkvine Admin</p></div><span className="hidden font-body text-[11px] font-semibold text-muted sm:inline">{session.user.name || "Admin"}</span></div></div>
          <div className="mx-auto max-w-[1280px] p-4 sm:p-6 md:p-8">
            <PendingStoreNotice status={store.status} rejectionReason={store.rejectionReason} />
          </div>
        </div>
      );
    }
  }

  return <div className="min-h-screen bg-white">
    <div className="border-b border-line bg-[#F7F3ED]"><div className="mx-auto flex min-h-14 max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:px-6 md:px-8"><div><p className="font-heading text-[17px] text-black">Larkvine Admin</p><p className="font-body text-[10px] uppercase tracking-[1.5px] text-muted">{isSuperAdminRole(role) ? "Platform administration" : "Use the menu at the top-left to navigate"}</p></div><span className="hidden font-body text-[11px] font-semibold text-muted sm:inline">{session?.user?.name || "Admin"}</span></div></div>
    <div className="mx-auto min-w-0 max-w-[1280px] p-4 sm:p-6 md:p-8">{children}</div>
  </div>;
}
