"use client";

// Renders the outbound WhatsApp handoff link. On click it records the handoff
// server-side (first click only) and then lets the browser navigate to the
// server-rendered wa.me URL. Recording is best-effort and never blocks or
// changes navigation.
export default function WhatsAppHandoff({
  href,
  orderId,
  token,
  className,
  children,
}: {
  href: string;
  orderId: string;
  token?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const record = () => {
    try {
      void fetch(`/api/orders/${orderId}/contact-opened`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(token ? { token } : {}),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // never block the handoff
    }
  };

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={record}>
      {children}
    </a>
  );
}
