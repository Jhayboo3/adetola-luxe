"use client";

import { useTransition } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/store/toast";
import { setStoreVerified } from "./actions";

export function StoreVerifyButton({ id, verified, name }: { id: string; verified: boolean; name: string }) {
  const toast = useToast((s) => s.show);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("verified", verified ? "0" : "1");
    startTransition(async () => {
      try {
        await setStoreVerified(fd);
        toast(verified ? `"${name}" verification removed.` : `"${name}" is now verified.`, verified ? "info" : "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to update verification", "error");
      }
    });
  };

  return (
    <Button
      type="button"
      variant={verified ? "outline" : "primary"}
      onClick={toggle}
      disabled={isPending}
      className="min-h-9 px-4 text-[11px]"
    >
      {isPending ? "Working…" : verified ? "Remove Verification" : "Verify Store"}
    </Button>
  );
}
