// Order lifecycle for the marketplace's manual (WhatsApp) checkout.
//
// Orders placed through the WhatsApp flow are recorded immediately but are not
// considered revenue: payment is arranged directly with the vendor outside the
// platform, so no money is verified here. They keep a dedicated status
// ("sent_to_whatsapp") instead of "pending", still appear in order history and
// analytics, but are excluded from revenue/total-sales calculations until the
// vendor moves them to a confirmed fulfilment status.
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

// Statuses that are excluded from revenue: manual orders not yet confirmed as
// paid, plus cancelled orders. Everything else (incl. confirmed/shipped/
// delivered and the historical "pending" records) counts as revenue.
export const ORDER_STATUSES_EXCLUDED_FROM_REVENUE = [
  ORDER_STATUS_SENT_TO_WHATSAPP,
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