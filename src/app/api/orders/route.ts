import { prisma } from "@/lib/prisma";
import { displayColor, formatPrice, parseJsonArray } from "@/lib/utils";

type CheckoutItem = { productId: string; quantity: number; size: string; color?: string };
const whatsappNumber = (process.env.WHATSAPP_ORDER_NUMBER || "2347011033320").replace(/\D/g, "");
const sizeNames: Record<string, string> = { XS: "Extra Small", S: "Small", M: "Medium", L: "Large", XL: "Extra Large", XXL: "Double Extra Large" };

async function createOrderCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    if (!(await prisma.order.findUnique({ where: { orderCode: code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not generate an order number. Please try again.");
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; zip?: string; items?: CheckoutItem[] };
    const name = body.name?.trim(); const email = body.email?.trim(); const address = body.address?.trim(); const city = body.city?.trim(); const state = body.state?.trim(); const zip = body.zip?.trim();
    if (!name || !email || !address || !city || !state || !zip || !body.items?.length) return Response.json({ error: "Complete your delivery details and add at least one item." }, { status: 400 });
    const requested = body.items.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
    if (requested.length !== body.items.length) return Response.json({ error: "Invalid cart quantity." }, { status: 400 });
    const ids = [...new Set(requested.map((item) => item.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: ids }, published: true } });
    if (products.length !== ids.length) return Response.json({ error: "One or more cart items are no longer available. Please refresh your cart." }, { status: 409 });
    const byId = new Map(products.map((product) => [product.id, product]));
    for (const item of requested) if (byId.get(item.productId)!.stock < item.quantity) return Response.json({ error: `${byId.get(item.productId)!.name} does not have enough stock.` }, { status: 409 });
    const orderColor = (item: CheckoutItem) => {
      const product = byId.get(item.productId)!;
      if (!product.colorSelectable) return "As shown";
      const color = displayColor(item.color || "");
      const allowed = parseJsonArray(product.colors).map(displayColor);
      if (!color || !allowed.includes(color)) throw new Error(`Choose an available color for ${product.name}.`);
      return color;
    };
    const subtotal = requested.reduce((sum, item) => sum + byId.get(item.productId)!.price * item.quantity, 0);
    const orderCode = await createOrderCode();
    const order = await prisma.$transaction(async (tx) => {
      for (const item of requested) {
        const updated = await tx.product.updateMany({ where: { id: item.productId, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (!updated.count) throw new Error(`${byId.get(item.productId)!.name} just sold out.`);
      }
      return tx.order.create({ data: { orderCode, email, name, phone: body.phone?.trim() || null, address, city, state, zip, subtotal, total: subtotal, paymentMethod: "whatsapp", items: { create: requested.map((item) => ({ productId: item.productId, quantity: item.quantity, size: item.size || "One Size", color: orderColor(item), price: byId.get(item.productId)!.price })) } }, include: { items: { include: { product: true } } } });
    });
    const itemSections = order.items.map((item) => [
      item.product.name,
      `Size: ${sizeNames[item.size.toUpperCase()] ?? item.size}`,
      `Colour: ${item.color}`,
      `Quantity: ${item.quantity}`,
      `Price: ${formatPrice(item.price * item.quantity)}`,
    ].join("\n"));
    const message = [
      "Hello Adetola Luxe,",
      "",
      "I would like to place the following order:",
      "",
      `*Order ID:* #${order.orderCode}`,
      `*Customer Name:* ${order.name}`,
      `*Phone Number:* ${order.phone || "Not provided"}`,
      `*Email Address:* ${order.email}`,
      `*Delivery Address:* ${order.address}, ${order.city}, ${order.state}, ${order.zip}`,
      "",
      "*Order Details*",
      itemSections.join("\n\n"),
      "",
      `*Total Amount:* ${formatPrice(order.total)}`,
      "",
      "Please confirm the order details and provide the payment and delivery information. Thank you.",
    ].join("\n");
    return Response.json({ id: order.orderCode, whatsappUrl: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not place order." }, { status: 500 });
  }
}
