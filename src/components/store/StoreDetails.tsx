"use client";

import { useState } from "react";

type DetailBlock = { title: string; content: string };

export default function StoreDetails({ storeName, blocks }: { storeName: string; blocks: DetailBlock[] }) {
  const [open, setOpen] = useState(false);
  if (!blocks.length) return null;

  return (
    <div className="mb-14">
      <button
        type="button"
        onClick={() => setOpen((visible) => !visible)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-white px-5 py-4 text-left transition-colors hover:border-primary"
      >
        <span className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-gold/10 text-gold transition-transform duration-300 ${open ? "rotate-45" : ""}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <span className="font-heading text-[15px] font-medium text-black md:text-[16px]">
            {open ? "Hide store details" : `More about ${storeName}`}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-4 w-4 fill-none stroke-current text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blocks.map((block) => (
            <div key={block.title} className="rounded-xl border border-line bg-white p-5">
              <h3 className="font-body text-[11px] font-semibold uppercase tracking-[2px] text-muted">{block.title}</h3>
              <div className="mt-2 whitespace-pre-line font-body text-[13px] leading-relaxed text-black/70">{block.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
