export type CheckoutRequestItem = {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
};

export type CheckoutRequestCustomer = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  gender?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  deliveryInfo?: string;
  size: string;
};

export function canonicalCheckoutRequest(items: CheckoutRequestItem[], customer: CheckoutRequestCustomer, userId: string | null) {
  const lines = items.map((item) => ({
    productId: item.productId.trim(),
    quantity: item.quantity,
    size: item.size?.trim() || "One Size",
    color: item.color?.trim() || "",
  }));
  lines.sort((a, b) => {
    const left = JSON.stringify([a.productId, a.size, a.color, a.quantity]);
    const right = JSON.stringify([b.productId, b.size, b.color, b.quantity]);
    return left < right ? -1 : left > right ? 1 : 0;
  });

  return JSON.stringify({
    version: 1,
    currency: "NGN",
    paymentMethod: "whatsapp",
    userId,
    customer: {
      name: customer.name.trim(),
      email: customer.email.trim().toLowerCase(),
      phone: customer.phone.trim(),
      whatsapp: customer.whatsapp.trim(),
      gender: customer.gender?.trim() || "",
      address: customer.address.trim(),
      city: customer.city.trim(),
      state: customer.state.trim(),
      zip: customer.zip?.trim() || "",
      deliveryInfo: customer.deliveryInfo?.trim() || "",
      size: customer.size.trim(),
    },
    items: lines,
  });
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
