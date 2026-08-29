"use client";

import { useToast } from "@/store/toast";

const ICONS: Record<string, string> = {
  success: "✓",
  error: "!",
  info: "i",
  warning: "!",
};

const STYLES: Record<string, { accent: string; iconBg: string }> = {
  success: { accent: "bg-primary", iconBg: "bg-primary text-white" },
  error: { accent: "bg-red-600", iconBg: "bg-red-600 text-white" },
  info: { accent: "bg-black", iconBg: "bg-black text-white" },
  warning: { accent: "bg-gold-dark", iconBg: "bg-gold-dark text-white" },
};

export default function Toast() {
  const toasts = useToast((state) => state.toasts);
  const dismiss = useToast((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[130] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
    >
      {toasts.map((toast) => {
        const style = STYLES[toast.type] ?? STYLES.success;
        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-[360px] items-start gap-3 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_16px_40px_rgba(10,36,28,0.14)] animate-toast-in"
          >
            <span className={`self-stretch w-1.5 shrink-0 ${style.accent}`} />
            <span className={`mt-3.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-heading text-[13px] leading-none ${style.iconBg}`}>
              {ICONS[toast.type] ?? ICONS.success}
            </span>
            <div className="flex-1 py-3 pr-3">
              {toast.title && <p className="font-heading text-[14px] font-medium leading-tight text-black">{toast.title}</p>}
              <p className="font-body text-[12px] leading-relaxed text-muted">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="px-3 pt-3 font-body text-[18px] leading-none text-muted transition-colors hover:text-black"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
