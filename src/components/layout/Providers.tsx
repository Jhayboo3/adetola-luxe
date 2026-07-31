"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { useCart } from "@/store/cart";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
