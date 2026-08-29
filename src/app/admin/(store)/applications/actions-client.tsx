"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/store/toast";
import { approveApplication, rejectApplication } from "./actions";

export function ApplicationActions({ id, name, showApprove }: { id: string; name: string; showApprove: boolean }) {
  const toast = useToast((s) => s.show);
  const [isPending, startTransition] = useTransition();
  const [confirmReject, setConfirmReject] = useState(false);
  const [reason, setReason] = useState("");

  const handleApprove = () => {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      try {
        await approveApplication(fd);
        toast(`"${name}" approved and is now live.`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to approve", "error");
      }
    });
  };

  const handleReject = () => {
    if (!confirmReject) {
      setConfirmReject(true);
      return;
    }
    const fd = new FormData();
    fd.set("id", id);
    fd.set("reason", reason);
    startTransition(async () => {
      try {
        await rejectApplication(fd);
        setConfirmReject(false);
        setReason("");
        toast(`"${name}" application rejected.`, "info");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to reject", "error");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        {showApprove && (
          <Button type="button" variant="outline" onClick={handleApprove} disabled={isPending} className="min-h-10 px-5 text-[11px]">
            {isPending ? "Working…" : "Approve"}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={handleReject} disabled={isPending} className="min-h-10 px-5 text-[11px] text-red-600 hover:bg-red-50">
          {confirmReject ? "Confirm Reject" : "Reject"}
        </Button>
        {confirmReject && (
          <Button type="button" onClick={() => setConfirmReject(false)} disabled={isPending} className="min-h-10 px-5 text-[11px]">
            Cancel
          </Button>
        )}
      </div>
      {confirmReject && (
        <div className="w-full sm:max-w-xs">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 font-body text-[12px] outline-none focus:border-red-400"
          />
        </div>
      )}
    </div>
  );
}
