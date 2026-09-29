"use client";
import CustomerPageError from "@/components/ui/CustomerPageError";
export default function Error({ reset }: { error: Error; reset: () => void }) { return <CustomerPageError reset={reset} title="Search results could not load" />; }
