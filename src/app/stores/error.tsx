"use client";
import CustomerPageError from "@/components/ui/CustomerPageError";
export default function Error({ reset }: { error: Error; reset: () => void }) { return <CustomerPageError reset={reset} title="Stores could not load" />; }
