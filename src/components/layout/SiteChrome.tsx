"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Header from "./Header";
import Footer from "./Footer";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoveRoute = pathname === "/love" || pathname.startsWith("/love/");
  if (isLoveRoute) return <>{children}</>;
  return (
    <>
      <Header />
      {children}
      <Footer />
      <div className="h-16 lg:hidden" aria-hidden="true" />
      <nav aria-label="Mobile marketplace" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(15,42,34,0.06)] lg:hidden">
        {[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
          { href: "/account/orders", label: "Orders" },
          { href: "/account/profile", label: "Account" },
        ].map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={`flex min-h-14 items-center justify-center px-1 font-body text-[11px] font-semibold no-underline ${pathname === item.href ? "text-primary" : "text-muted"}`}>{item.label}</Link>)}
      </nav>
    </>
  );
}
