"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "@/store/cart";
import SearchBar from "./SearchBar";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/shop", label: "Shop" },
  { href: "/stores", label: "Stores" },
  { href: "/cart", label: "Cart" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/sell", label: "Sell on Larkvine" },
];

const adminLinks = [
  { href: "/admin/dashboard", label: "Admin Dashboard" },
  { href: "/admin/store", label: "Store" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/discounts", label: "Discounts" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const itemCount = useCart((state) => state.getItemCount());
  const [cartBump, setCartBump] = useState(0);
  const prevCount = useRef(itemCount);
  useEffect(() => {
    if (itemCount > prevCount.current) setCartBump((b) => b + 1);
    prevCount.current = itemCount;
  }, [itemCount]);
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "admin";
  const isVendor = role === "vendor";
  const canManageStore = isAdmin || isVendor;
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab") return;
      const focusable = menuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    const trigger = menuTriggerRef.current;
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = ""; trigger?.focus(); };
  }, [open]);

  const menuLink = (href: string, label: string) => {
    const path = href.split("#")[0];
    const active = href.includes("#") ? false : path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
    return <Link key={`${href}-${label}`} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`rounded-xl px-4 py-3 font-body text-[12px] font-semibold uppercase tracking-[1.5px] no-underline transition-colors ${active ? "bg-primary text-white" : "text-black hover:bg-black/5 hover:text-primary"}`}>{label}{label === "Cart" && itemCount > 0 ? ` (${itemCount})` : ""}</Link>;
  };

  return <>
    <header className="sticky top-0 z-50 mx-2 mt-2 rounded-[20px] border border-line/70 bg-white/95 shadow-[0_8px_30px_rgba(15,42,34,0.06)] backdrop-blur-md md:mx-4 md:rounded-[24px]">
      <div className="relative mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 md:px-8">
        <button ref={menuTriggerRef} type="button" onClick={() => setOpen(true)} aria-label="Open navigation menu" aria-expanded={open} aria-controls="site-navigation" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-white text-black transition-colors hover:border-primary hover:text-primary active:scale-95 lg:hidden">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <Link href="/" className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 no-underline lg:static lg:translate-x-0" aria-label="Larkvine home"><Image src="/logomark.png" alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover sm:h-11 sm:w-11" preload /><span className="hidden font-heading text-[19px] text-[#0F2A22] lg:inline">Larkvine</span></Link>
        <nav aria-label="Marketplace" className="hidden items-center gap-6 font-body text-[12px] font-semibold text-[#0F2A22] lg:flex">
          <Link href="/shop" className="hover:text-primary" aria-current={pathname === "/shop" ? "page" : undefined}>Shop</Link>
          <Link href="/stores" className="hover:text-primary" aria-current={pathname === "/stores" ? "page" : undefined}>Stores</Link>
          <Link href="/account/orders" className="hover:text-primary" aria-current={pathname === "/account/orders" ? "page" : undefined}>Orders</Link>
          <Link href={session ? "/account/profile" : "/login"} className="hover:text-primary">{session ? "Account" : "Sign in"}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <SearchBar />
          <Link href="/cart" className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-black no-underline transition-colors hover:border-primary hover:text-primary" aria-label={`Cart with ${itemCount} items`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="M5 7h14l-1 12H6L5 7Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
            {itemCount > 0 && <span key={cartBump} className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white animate-pop">{itemCount}</span>}
          </Link>
        </div>
      </div>
    </header>
    {open && <div className="fixed inset-0 z-[90]" role="presentation">
      <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-black/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-label="Close navigation menu" />
      <aside ref={menuRef} id="site-navigation" role="dialog" aria-modal="true" aria-label="Site navigation" className="absolute inset-y-0 left-0 z-[100] flex w-[min(88vw,380px)] flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-5"><span className="font-heading text-[19px]">Menu</span><button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-xl transition-colors hover:border-primary hover:text-primary">×</button></div>
        <nav className="flex flex-col gap-1 p-4">{publicLinks.map((link) => menuLink(link.href, link.label))}</nav>
        {session && <div className="p-4"><p className="mb-2 px-4 font-body text-[10px] font-bold uppercase tracking-[2px] text-muted">Account</p>{menuLink("/account/orders", "My Orders")}{menuLink("/account/profile", "Profile")}</div>}
        {canManageStore && <div className="p-4"><p className="mb-2 px-4 font-body text-[10px] font-bold uppercase tracking-[2px] text-muted">{isVendor ? "Store Dashboard" : "Administration"}</p><nav className="flex flex-col gap-1">{adminLinks.map((link) => menuLink(link.href, link.label))}</nav>{isAdmin && <><p className="mb-2 mt-4 px-4 font-body text-[10px] font-bold uppercase tracking-[2px] text-muted">Platform Admin</p><nav className="flex flex-col gap-1">{menuLink("/admin/applications", "Store Applications")}{menuLink("/admin/stores", "All Stores")}</nav></>}</div>}
        <div className="mt-auto p-4">{session ? <button type="button" onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }} className="cta-secondary w-full">Sign Out</button> : <div className="grid grid-cols-2 gap-3"><Link href="/login" onClick={() => setOpen(false)} className="cta-primary">Login</Link><Link href="/signup" onClick={() => setOpen(false)} className="cta-secondary">Register</Link></div>}</div>
      </aside>
    </div>}
  </>;
}
