"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const sidebarLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/discounts", label: "Discounts" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (pathname === "/admin/login" || pathname === "/admin/signup") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 flex-shrink-0 border-r border-line bg-black md:block">
        <div className="p-6">
          <Link
            href="/admin/dashboard"
            className="font-heading text-lg text-white no-underline"
          >
            Adetola Admin
          </Link>
        </div>
        <nav className="mt-4 flex flex-col gap-1 px-4">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded px-4 py-3 font-body text-[11px] uppercase tracking-[2px] no-underline transition-colors ${
                pathname === link.href
                  ? "bg-gold text-black"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/"
            className="mt-8 rounded px-4 py-3 font-body text-[11px] uppercase tracking-[2px] text-white/40 no-underline transition-colors hover:text-white"
          >
            Back to Site
          </Link>
        </nav>
      </aside>

      <div className="flex-1 bg-white">
        <header className="flex h-16 items-center justify-between border-b border-line bg-white px-8">
          <div className="flex items-center gap-4 md:hidden">
            <span className="font-heading text-base text-black">
              Adetola Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-body text-[11px] text-muted">
              {session?.user?.name || "Admin"}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="font-body text-[11px] uppercase tracking-[2px] text-muted hover:text-black cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </header>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}
