"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "@/store/cart";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const itemCount = useCart((s) => s.getItemCount());
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 mx-2 mt-2 rounded-[20px] border border-line/70 bg-white/95 shadow-[0_8px_30px_rgba(15,42,34,0.06)] backdrop-blur-md md:mx-4 md:rounded-[24px]">
      <div className="mx-auto flex h-[75px] max-w-[1200px] items-center justify-between px-8">
        <Link
          href="/"
          className="flex items-center no-underline"
        >
          <Image
            src="/brand-logo.png"
            alt="Adetola Luxe"
            width={120}
            height={40}
            className="h-[40px] w-auto rounded-lg"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black no-underline transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/shop#catalog-search"
            className="inline-flex items-center gap-2 font-body text-[11px] font-medium uppercase tracking-[2px] text-black no-underline transition-colors hover:text-primary"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
            Search
          </Link>
          <Link
            href="/cart"
            className="relative font-body text-[11px] font-medium uppercase tracking-[2px] text-black no-underline transition-colors hover:text-primary"
          >
            Cart
            {itemCount > 0 && (
              <span className="absolute -right-3 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-white">
                {itemCount}
              </span>
            )}
          </Link>
          {session ? (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black cursor-pointer bg-transparent border-none hover:text-primary"
            >
              Sign Out
            </button>
          ) : (
            <Link
              href="/login"
              className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black no-underline transition-colors hover:text-primary"
            >
              Sign In
            </Link>
          )}
        </nav>

        <button
          className="flex items-center gap-2 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span className="font-body text-[11px] font-medium uppercase tracking-[2px]">
            Menu
          </span>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-white px-8 pb-8 pt-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black no-underline"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/shop#catalog-search"
              className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black no-underline"
              onClick={() => setMobileOpen(false)}
            >
              Search Clothing
            </Link>
            <Link
              href="/cart"
              className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black no-underline"
              onClick={() => setMobileOpen(false)}
            >
              Cart ({itemCount})
            </Link>
            {session ? (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black text-left bg-transparent border-none cursor-pointer"
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/login"
                className="font-body text-[11px] font-medium uppercase tracking-[2px] text-black no-underline"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
