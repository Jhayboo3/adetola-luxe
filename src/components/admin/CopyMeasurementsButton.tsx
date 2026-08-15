"use client";

import { useState } from "react";

export default function CopyMeasurementsButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="rounded-full border border-primary px-4 py-2 font-body text-[10px] font-semibold uppercase tracking-[1px] text-primary">{copied ? "Copied" : "Copy Measurements"}</button>;
}
