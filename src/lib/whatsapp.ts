// Pure WhatsApp order-routing helpers. Deliberately dependency-free (no
// framework, provider or alias imports) so they can be unit-tested directly and
// reused on the server. The message is always built from persisted order data,
// never from untrusted browser values.

export type OrderRouteItem = {
  name: string;
  size: string;
  color: string;
  quantity: number;
  total: number;
};

export type OrderRoute = {
  orderCode?: string | null;
  storeName: string;
  customerName: string;
  address: string;
  deliveryInfo?: string | null;
  items: OrderRouteItem[];
  total: number;
};

// Mirrors formatPrice in src/lib/utils.ts. Kept here so this module has no
// imports; a test asserts the two stay identical.
export function formatNaira(value: number): string {
  return `₦${value.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

const SIZE_NAMES: Record<string, string> = {
  XS: "Extra Small",
  S: "Small",
  M: "Medium",
  L: "Large",
  XL: "Extra Large",
  XXL: "Double Extra Large",
  XXXL: "Triple Extra Large",
};

// A human-facing, non-sensitive reference for a vendor order. The internal
// database id is never exposed.
export function orderReference(orderCode?: string | null): string {
  const code = (orderCode ?? "").trim();
  return code ? `LV-${code}` : "Larkvine order";
}

// Normalize any user-entered number to digits-only E.164-ish form for wa.me.
// A leading local 0 becomes 234 (Nigeria). Returns null when the result is not
// a plausible international number, so callers never build an unusable link.
export function normalizeWhatsappNumber(raw?: string | null): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const international = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  if (international.length < 10 || international.length > 15) return null;
  return international;
}

export function whatsappOrderUrl(number?: string | null, message = ""): string | null {
  const normalized = normalizeWhatsappNumber(number);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

// The single canonical vendor message. Contains only this order's items, the
// customer-visible reference, totals and delivery details — never database IDs,
// internal tokens, other vendors' products or platform metadata.
export function orderWhatsappMessage(order: OrderRoute): string {
  const items = order.items.map((item, index) =>
    [
      `${index + 1}. ${item.name}`,
      `   Size: ${SIZE_NAMES[item.size.toUpperCase()] ?? item.size}`,
      `   Colour: ${item.color}`,
      `   Qty: ${item.quantity}`,
      `   Price: ${formatNaira(item.total)}`,
    ].join("\n"),
  );

  const delivery = [order.address, order.deliveryInfo?.trim()].filter(Boolean).join("\n");

  return [
    `Hello ${order.storeName},`,
    "",
    "I just placed an order through Larkvine.",
    "",
    "Order Reference:",
    orderReference(order.orderCode),
    "",
    "Items:",
    items.join("\n\n"),
    "",
    "Order Total:",
    formatNaira(order.total),
    "",
    "Customer:",
    order.customerName,
    "",
    "Delivery Location:",
    delivery,
    "",
    "Payment and delivery are arranged directly with you on WhatsApp.",
    "Please confirm availability, payment instructions and delivery details.",
  ].join("\n");
}
