"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Snapshot = { y: number; carousels: Record<string, number> };

// Module-level memory persists across soft navigations within a client session,
// so each path keeps its own scroll position (vertical + carousel horizontal).
const memory = new Map<string, Snapshot>();

function captureCarousels(): Record<string, number> {
  const result: Record<string, number> = {};
  document.querySelectorAll<HTMLElement>("[data-carousel]").forEach((el, index) => {
    const label = el.getAttribute("data-carousel") || `carousel-${index}`;
    result[label] = el.scrollLeft;
  });
  return result;
}

function restoreCarousels(carousels: Record<string, number>) {
  requestAnimationFrame(() => {
    document.querySelectorAll<HTMLElement>("[data-carousel]").forEach((el, index) => {
      const label = el.getAttribute("data-carousel") || `carousel-${index}`;
      const left = carousels[label];
      if (typeof left === "number") el.scrollLeft = left;
    });
  });
}

export default function ScrollRestorer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const lastKey = useRef<string>(key);

  // Save the current page's scroll as we scroll or before navigating away.
  useEffect(() => {
    const save = () => {
      memory.set(key, { y: window.scrollY, carousels: captureCarousels() });
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("beforeunload", save);
    return () => {
      window.removeEventListener("scroll", save);
      window.removeEventListener("beforeunload", save);
      memory.set(key, { y: window.scrollY, carousels: captureCarousels() });
    };
  }, [key]);

  // Restore position on back/forward navigation to a known path.
  useEffect(() => {
    const previousKey = lastKey.current;
    lastKey.current = key;
    if (previousKey === key) return;

    const saved = memory.get(key);
    if (!saved) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }
    // Delay so server-rendered content has mounted, then restore without a flash.
    const raf = requestAnimationFrame(() => {
      window.scrollTo({ top: saved.y, behavior: "instant" as ScrollBehavior });
      if (Object.keys(saved.carousels).length) restoreCarousels(saved.carousels);
    });
    return () => cancelAnimationFrame(raf);
  }, [key]);

  return null;
}
