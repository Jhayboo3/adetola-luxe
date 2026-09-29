"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/store/toast";
import { acceptOrder, rejectOrder } from "./actions";
import { canAcceptOrder, canVendorCancelOrder, REJECTION_REASONS } from "@/lib/orders";

export default function VendorOrderActions({ id, status }: { id: string; status: string }) {
  const toast = useToast((state) => state.show);
  const [isPending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<string>("out_of_stock");

  const accept = () => {
    const formData = new FormData();
    formData.set("id", id);
    startTransition(async () => {
      try {
        await acceptOrder(formData);
        toast("Order accepted.", "success", "Accepted");
      } catch (error) {
        toast(error instanceof Error ? error.message : "Could not accept the order.", "error", "Not accepted");
      }
    });
  };

  const reject = () => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("reason", reason);
    startTransition(async () => {
      try {
        await rejectOrder(formData);
        toast("Order cancelled and stock restored.", "info", "Cancelled");
        setRejecting(false);
      } catch (error) {
        toast(error instanceof Error ? error.message : "Could not cancel the order.", "error", "Not cancelled");
      }
    });
  };

  const acceptable = canAcceptOrder(status);
  const cancellable = canVendorCancelOrder(status);
  if (!acceptable && !cancellable) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap gap-3">
        {acceptable && (
          <button type="button" onClick={accept} disabled={isPending} className="cta-primary min-h-11 px-6 py-2 text-[11px]">
            {isPending ? "Working…" : "Accept order"}
          </button>
        )}
        {cancellable && (
          <button type="button" onClick={() => setRejecting((value) => !value)} disabled={isPending} className="cta-danger min-h-11 px-6 py-2 text-[11px]">
            {rejecting ? "Close" : "Reject / Cancel"}
          </button>
        )}
      </div>
      {acceptable && <p className="font-body text-[11px] text-muted">Accepting acknowledges the order and keeps the stock reserved. It is not payment confirmation.</p>}
      {rejecting && cancellable && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 font-body text-[11px] text-muted">
            Reason
            <select value={reason} onChange={(event) => setReason(event.target.value)} className="border border-line bg-white p-2 text-[12px] text-black">
              {Object.entries(REJECTION_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="button" onClick={reject} disabled={isPending} className="cta-danger min-h-10 px-5 py-2 text-[10px]">
            {isPending ? "Working…" : "Confirm cancellation"}
          </button>
        </div>
      )}
    </div>
  );
}
