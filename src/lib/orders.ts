// Order lifecycle for the marketplace's manual (WhatsApp) checkout.
// Larkvine does not verify payment or collect vendor funds in this flow.
export const ORDER_STATUS_SENT_TO_WHATSAPP = "sent_to_whatsapp";
export const ORDER_STATUS_PENDING = "pending";
export const ORDER_STATUS_CONFIRMED = "confirmed";
export const ORDER_STATUS_SHIPPED = "shipped";
export const ORDER_STATUS_DELIVERED = "delivered";
export const ORDER_STATUS_CANCELLED = "cancelled";
export const ORDER_STATUS_EXPIRED = "expired";

export const ORDER_STATUSES = [
  ORDER_STATUS_SENT_TO_WHATSAPP,
  ORDER_STATUS_PENDING,
  ORDER_STATUS_CONFIRMED,
  ORDER_STATUS_SHIPPED,
  ORDER_STATUS_DELIVERED,
  ORDER_STATUS_CANCELLED,
  ORDER_STATUS_EXPIRED,
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  [ORDER_STATUS_SENT_TO_WHATSAPP]: "Sent to WhatsApp",
  [ORDER_STATUS_PENDING]: "Pending",
  [ORDER_STATUS_CONFIRMED]: "Confirmed",
  [ORDER_STATUS_SHIPPED]: "Shipped",
  [ORDER_STATUS_DELIVERED]: "Delivered",
  [ORDER_STATUS_CANCELLED]: "Cancelled",
  [ORDER_STATUS_EXPIRED]: "Expired",
};

// Customer-facing lifecycle wording. Never implies Larkvine processed payment.
export const ORDER_STATUS_BUYER_LABELS: Record<string, string> = {
  [ORDER_STATUS_SENT_TO_WHATSAPP]: "Order placed",
  [ORDER_STATUS_PENDING]: "Order placed",
  [ORDER_STATUS_CONFIRMED]: "Seller accepted",
  [ORDER_STATUS_SHIPPED]: "Processing",
  [ORDER_STATUS_DELIVERED]: "Completed",
  [ORDER_STATUS_CANCELLED]: "Cancelled",
  [ORDER_STATUS_EXPIRED]: "Expired",
};

export function orderStatusLabel(status?: string | null) {
  return (status && ORDER_STATUS_LABELS[status]) || status || "—";
}

export function buyerOrderStatusLabel(status?: string | null) {
  return (status && ORDER_STATUS_BUYER_LABELS[status]) || orderStatusLabel(status);
}

// Vendor/admin fulfilment graph. `expired` is a system-only terminal state and
// is intentionally not reachable through this map (the expiry sweep enforces it).
const NEXT_STATUSES: Record<string, readonly string[]> = {
  [ORDER_STATUS_SENT_TO_WHATSAPP]: [ORDER_STATUS_PENDING, ORDER_STATUS_CONFIRMED, ORDER_STATUS_CANCELLED],
  [ORDER_STATUS_PENDING]: [ORDER_STATUS_CONFIRMED, ORDER_STATUS_CANCELLED],
  [ORDER_STATUS_CONFIRMED]: [ORDER_STATUS_SHIPPED, ORDER_STATUS_CANCELLED],
  [ORDER_STATUS_SHIPPED]: [ORDER_STATUS_DELIVERED],
  [ORDER_STATUS_DELIVERED]: [],
  [ORDER_STATUS_CANCELLED]: [],
  [ORDER_STATUS_EXPIRED]: [],
};

export function canTransitionOrderStatus(current: string, next: string) {
  return current === next || (NEXT_STATUSES[current]?.includes(next) ?? false);
}

// System-only expiry is allowed only from unaccepted states.
export const EXPIRABLE_STATUSES = [ORDER_STATUS_SENT_TO_WHATSAPP, ORDER_STATUS_PENDING] as const;
// Vendor may accept (→ confirmed) only from unaccepted states.
export const ACCEPTABLE_STATUSES = EXPIRABLE_STATUSES;
// Customer may cancel their own order only before the vendor accepts it.
export const CUSTOMER_CANCELLABLE_STATUSES = EXPIRABLE_STATUSES;
// Vendor may reject/cancel before dispatch (not once shipped/delivered).
export const VENDOR_CANCELLABLE_STATUSES = [ORDER_STATUS_SENT_TO_WHATSAPP, ORDER_STATUS_PENDING, ORDER_STATUS_CONFIRMED] as const;

export function canExpireOrder(status: string) {
  return (EXPIRABLE_STATUSES as readonly string[]).includes(status);
}
export function canAcceptOrder(status: string) {
  return (ACCEPTABLE_STATUSES as readonly string[]).includes(status);
}
export function canCustomerCancelOrder(status: string) {
  return (CUSTOMER_CANCELLABLE_STATUSES as readonly string[]).includes(status);
}
export function canVendorCancelOrder(status: string) {
  return (VENDOR_CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

// Bounded vendor rejection reasons. Stored as the enum value; only the mapped
// customer-facing text is ever shown publicly. Never expose freeform notes.
export const REJECTION_REASONS = {
  out_of_stock: "Item is no longer in stock",
  unable_to_fulfil: "Seller is unable to fulfil this order",
  customer_unreachable: "Seller could not reach the customer",
  customer_requested: "Cancelled at the customer's request",
  duplicate_order: "Duplicate order",
  other: "Cancelled by the seller",
} as const;

export type RejectionReason = keyof typeof REJECTION_REASONS;

export function isRejectionReason(value: string): value is RejectionReason {
  return Object.prototype.hasOwnProperty.call(REJECTION_REASONS, value);
}

export function rejectionReasonLabel(reason?: string | null) {
  return reason && isRejectionReason(reason) ? REJECTION_REASONS[reason] : null;
}
