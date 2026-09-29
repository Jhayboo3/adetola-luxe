"use client";

import { useTransition } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/store/toast";
import { updateStoreStatus } from "./actions";

export function StoreManageActions({ id, name, status }: { id: string; name: string; status: string }) {
  const toast = useToast((s) => s.show);
  const [isPending, startTransition] = useTransition();

  const run = (fd: FormData, message: string) => {
    startTransition(async () => {
      try {
        await updateStoreStatus(fd);
        toast(message);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Action failed", "error");
      }
    });
  };

  const suspend = () => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", "suspended");
    run(fd, `"${name}" suspended.`);
  };

  const activate = () => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", "approved");
    run(fd, `"${name}" is live again.`);
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {status === "suspended" ? (
        <Button type="button" variant="outline" onClick={activate} disabled={isPending} className="min-h-9 px-4 text-[11px]">
          {isPending ? "Working…" : "Reactivate"}
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={suspend} disabled={isPending} className="min-h-9 px-4 text-[11px]">
          {isPending ? "Working…" : "Suspend"}
        </Button>
      )}

    </div>
  );
}
