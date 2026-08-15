"use client";

import { useState } from "react";

export default function CopyMeasurementsButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="cta-secondary min-h-10 px-4 py-2 text-[10px]">{copied ? "Copied" : "Copy Measurements"}</button>;
}
