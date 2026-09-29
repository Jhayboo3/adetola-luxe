"use client";

import { useActionState } from "react";
import { cancelOwnOrder, type CancelOrderState } from "./actions";

export default function CancelOrderButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<CancelOrderState, FormData>(cancelOwnOrder, { ok: false });
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="font-body text-[12px] font-semibold text-red-700 underline underline-offset-4 disabled:opacity-50"
      >
        {pending ? "Cancelling…" : "Cancel order"}
      </button>
      {state.error && <p className="mt-1 font-body text-[11px] text-red-700">{state.error}</p>}
      {state.ok && <p className="mt-1 font-body text-[11px] text-green-700">Order cancelled.</p>}
    </form>
  );
}
