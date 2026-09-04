import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STORE_STATUSES, isSuperAdminRole } from "@/lib/store";
import { PendingStoreNotice } from "../pending-notice";


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

  // A platform super admin (or any authenticated user) with no owned store must
  // not reach the store-scoped management pages. Show a friendly notice instead
  // of letting requireStore() throw an unhandled error. Platform admins can
  // still reach their platform routes (/admin/applications, /admin/stores).
  if (session?.user) {
    const store = await prisma.store.findFirst({ where: { ownerId: session.user.id } });
    if (!store) {
      return (
        <div className="min-h-screen bg-white">
          <div className="border-b border-line bg-[#F7F3ED]"><div className="mx-auto flex min-h-14 max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:px-6 md:px-8"><div><p className="font-heading text-[17px] text-black">Larkvine Admin</p></div><span className="hidden font-body text-[11px] font-semibold text-muted sm:inline">{session.user.name || "Admin"}</span></div></div>
          <div className="mx-auto max-w-[1280px] p-4 sm:p-6 md:p-8">
            <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#005C29]/10">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#005C29" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
              </div>
              <h1 className="mt-6 font-heading text-[24px] font-medium text-black">No store linked to your account</h1>
              <p className="mx-auto mt-3 max-w-sm font-body text-[13px] leading-relaxed text-muted">
                {isSuperAdminRole(role)
                  ? "You are signed in as a platform administrator. To manage a store, use the platform tools in the menu above, or sign out and into the vendor account that owns the store."
                  : "You do not currently own a store. If you applied to sell, your application may still be pending review."}
              </p>
              <Link href="/" className="mt-8 inline-block font-body text-[12px] uppercase tracking-[2px] text-primary underline underline-offset-4">Back to marketplace</Link>
            </div>
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
