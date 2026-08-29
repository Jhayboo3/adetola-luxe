import Link from "next/link";

export function PendingStoreNotice({ status, rejectionReason }: { status: string; rejectionReason?: string | null }) {
  const isRejected = status === "rejected";
  const isSuspended = status === "suspended";

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isRejected ? "bg-red-100" : "bg-[#005C29]/10"}`}>
        {isRejected ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#005C29" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
        )}
      </div>

      {isRejected ? (
        <h1 className="mt-6 font-heading text-[24px] font-medium text-black">Application not approved</h1>
      ) : isSuspended ? (
        <h1 className="mt-6 font-heading text-[24px] font-medium text-black">Store suspended</h1>
      ) : (
        <h1 className="mt-6 font-heading text-[24px] font-medium text-black">Your store application is under review.</h1>
      )}

      <p className="mx-auto mt-3 max-w-sm font-body text-[13px] leading-relaxed text-muted">
        {isRejected
          ? "Your store application was not approved by our team."
          : isSuspended
            ? "Your store has been suspended by an administrator and is no longer publicly available."
            : "You will be able to manage your storefront once your application has been approved."}
      </p>

      {isRejected && rejectionReason && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left font-body text-[12px] text-red-700">
          <p className="font-semibold">Reason</p>
          <p className="mt-1">{rejectionReason}</p>
        </div>
      )}

      <Link href="/" className="mt-8 inline-block font-body text-[12px] uppercase tracking-[2px] text-primary underline underline-offset-4">
        Back to marketplace
      </Link>
    </div>
  );
}
