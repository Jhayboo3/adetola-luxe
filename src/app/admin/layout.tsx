"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  if (pathname === "/admin/login" || pathname === "/admin/signup") return <>{children}</>;
  return <div className="min-h-screen bg-white">
    <div className="border-b border-line bg-[#F7F3ED]"><div className="mx-auto flex min-h-14 max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:px-6 md:px-8"><div><p className="font-heading text-[17px] text-black">Larkvine Admin</p><p className="font-body text-[10px] uppercase tracking-[1.5px] text-muted">Use the menu at the top-left to navigate</p></div><span className="hidden font-body text-[11px] font-semibold text-muted sm:inline">{session?.user?.name || "Admin"}</span></div></div>
    <div className="mx-auto min-w-0 max-w-[1280px] p-4 sm:p-6 md:p-8">{children}</div>
  </div>;
}
