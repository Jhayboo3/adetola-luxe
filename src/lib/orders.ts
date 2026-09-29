// Order lifecycle for the marketplace's manual (WhatsApp) checkout.
// Larkvine does not verify payment or collect vendor funds in this flow.
export const ORDER_STATUS_SENT_TO_WHATSAPP = "sent_to_whatsapp";
export const ORDER_STATUS_PENDING = "pending";
export const ORDER_STATUS_CONFIRMED = "confirmed";
export const ORDER_STATUS_SHIPPED = "shipped";
export const ORDER_STATUS_DELIVERED = "delivered";
export const ORDER_STATUS_CANCELLED = "cancelled";

export const ORDER_STATUSES = [
  ORDER_STATUS_SENT_TO_WHATSAPP,
  ORDER_STATUS_PENDING,
  ORDER_STATUS_CONFIRMED,
  ORDER_STATUS_SHIPPED,
  ORDER_STATUS_DELIVERED,
  ORDER_STATUS_CANCELLED,
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  [ORDER_STATUS_SENT_TO_WHATSAPP]: "Sent to WhatsApp",
  [ORDER_STATUS_PENDING]: "Pending",
  [ORDER_STATUS_CONFIRMED]: "Confirmed",
  [ORDER_STATUS_SHIPPED]: "Shipped",
  [ORDER_STATUS_DELIVERED]: "Delivered",
  [ORDER_STATUS_CANCELLED]: "Cancelled",
};

export function orderStatusLabel(status?: string | null) {
  return (status && ORDER_STATUS_LABELS[status]) || status || "—";
}

const NEXT_STATUSES: Record<string, readonly string[]> = {
  [ORDER_STATUS_SENT_TO_WHATSAPP]: [ORDER_STATUS_PENDING, ORDER_STATUS_CONFIRMED, ORDER_STATUS_CANCELLED],
  [ORDER_STATUS_PENDING]: [ORDER_STATUS_CONFIRMED, ORDER_STATUS_CANCELLED],
  [ORDER_STATUS_CONFIRMED]: [ORDER_STATUS_SHIPPED, ORDER_STATUS_CANCELLED],
  [ORDER_STATUS_SHIPPED]: [ORDER_STATUS_DELIVERED],
  [ORDER_STATUS_DELIVERED]: [],
  [ORDER_STATUS_CANCELLED]: [],
};

export function canTransitionOrderStatus(current: string, next: string) {
  return current === next || (NEXT_STATUSES[current]?.includes(next) ?? false);
}
