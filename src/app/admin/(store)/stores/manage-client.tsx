"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/store/toast";
import { updateStoreStatus, deleteStore } from "./actions";

export function StoreManageActions({ id, name, status }: { id: string; name: string; status: string }) {
  const toast = useToast((s) => s.show);
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (action: (fd: FormData) => Promise<void>, message: string) => {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      try {
        await action(fd);
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
    run(async (f) => updateStoreStatus(f), `"${name}" suspended.`);
  };

  const activate = () => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", "approved");
    run(async (f) => updateStoreStatus(f), `"${name}" is live again.`);
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      try {
        await deleteStore(fd);
        setConfirmDelete(false);
        toast(`"${name}" deleted.`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Delete failed", "error");
      }
    });
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

      {confirmDelete ? (
        <>
          <Button type="button" variant="primary" onClick={handleDelete} disabled={isPending} className="min-h-9 px-4 text-[11px]">
            {isPending ? "Deleting…" : "Confirm Delete"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={isPending} className="min-h-9 px-4 text-[11px]">
            Cancel
          </Button>
        </>
      ) : (
        <Button type="button" variant="ghost" onClick={handleDelete} disabled={isPending} className="min-h-9 px-4 text-[11px] text-red-600 hover:bg-red-50">
          Delete
        </Button>
      )}

      {confirmDelete && (
        <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 sm:max-w-sm">
          <p className="font-heading text-[13px] font-semibold text-red-800">Delete Store?</p>
          <p className="mt-1 font-body text-[12px] leading-relaxed text-red-700">
            This action will permanently remove the store and its associated marketplace data. Are you sure you want to continue?
          </p>
        </div>
      )}
    </div>
  );
}
