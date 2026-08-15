import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { displayColor, formatPrice, parseJsonArray } from "@/lib/utils";
import { measurementLines, parseMeasurements, profileMissing } from "@/lib/measurements";

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

function whatsappMessage(order: { orderCode: string; name: string; phone: string; whatsapp: string; email: string; gender: string; address: string; city: string; state: string; zip: string; deliveryInfo: string; total: number; measurementUnit: string; measurements: Record<string, number>; items: { name: string; size: string; color: string; quantity: number; total: number }[] }) {
  const itemSections = order.items.map((item) => [item.name, `Size: ${sizeNames[item.size.toUpperCase()] ?? item.size}`, `Colour: ${item.color}`, `Quantity: ${item.quantity}`, `Price: ${formatPrice(item.total)}`].join("\n"));
  return ["*NEW CLOTHING ORDER*", "", `*Order ID:* #${order.orderCode}`, `*Customer:* ${order.name}`, `*Phone:* ${order.phone}`, `*WhatsApp:* ${order.whatsapp}`, `*Email:* ${order.email}`, `*Gender:* ${order.gender}`, "", "*ORDER DETAILS*", itemSections.join("\n\n"), "", `*Total:* ${formatPrice(order.total)}`, "", "*BODY MEASUREMENTS*", ...measurementLines(order.gender, order.measurements, order.measurementUnit), "", "*DELIVERY ADDRESS*", `${order.address}, ${order.city}, ${order.state}${order.zip ? `, ${order.zip}` : ""}`, order.deliveryInfo || ""].filter((line, index, list) => line !== "" || list[index - 1] !== "").join("\n");
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Please sign in before checkout." }, { status: 401 });
    const body = await request.json() as { checkoutToken?: string; items?: CheckoutItem[] };
    if (!body.checkoutToken || !/^[a-zA-Z0-9-]{10,100}$/.test(body.checkoutToken) || !body.items?.length) return Response.json({ error: "Invalid checkout request." }, { status: 400 });
    const previous = await prisma.order.findUnique({ where: { checkoutToken: body.checkoutToken }, select: { orderCode: true, userId: true, notes: true } });
    if (previous) return previous.userId === session.user.id ? Response.json({ id: previous.orderCode, whatsappUrl: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(previous.notes || "")}` }) : Response.json({ error: "Invalid checkout request." }, { status: 409 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return Response.json({ error: "Please sign in before checkout." }, { status: 401 });
    const missing = profileMissing(user);
    if (missing.length) return Response.json({ error: `Your profile or body measurements are incomplete: ${missing.join(", ")}.` }, { status: 422 });

    const requested = body.items.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0 && typeof item.productId === "string");
    if (requested.length !== body.items.length) return Response.json({ error: "Invalid cart quantity." }, { status: 400 });
    const ids = [...new Set(requested.map((item) => item.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: ids }, published: true, stock: { gt: 0 } } });
    if (products.length !== ids.length) return Response.json({ error: "One or more cart items are sold out or unavailable." }, { status: 409 });
    const byId = new Map(products.map((product) => [product.id, product]));
    const totals = new Map<string, number>();
    for (const item of requested) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
    for (const [id, quantity] of totals) if (byId.get(id)!.stock < quantity) return Response.json({ error: `${byId.get(id)!.name} does not have enough stock.` }, { status: 409 });

    const normalized = requested.map((item) => {
      const product = byId.get(item.productId)!;
      const sizes = parseJsonArray(product.sizes);
      const size = item.size || "One Size";
      if (sizes.length && !sizes.includes(size)) throw new Error(`Choose an available size for ${product.name}.`);
      let color = "As shown";
      if (product.colorSelectable) {
        color = displayColor(item.color || "");
        if (!parseJsonArray(product.colors).map(displayColor).includes(color)) throw new Error(`Choose an available colour for ${product.name}.`);
      }
      return { ...item, size, color, product };
    });
    const subtotal = normalized.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const orderCode = await createOrderCode();
    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();
    const measurements = parseMeasurements(user.measurements);
    const snapshot = JSON.stringify(measurements);
    const message = whatsappMessage({ orderCode, name: user.name, phone: user.phone!, whatsapp: user.whatsapp!, email: user.email, gender: user.gender!, address: user.address!, city: user.city!, state: user.state!, zip: user.zip ?? "", deliveryInfo: user.deliveryInfo ?? "", total: subtotal, measurementUnit: user.measurementUnit, measurements, items: normalized.map((item) => ({ name: item.product.name, size: item.size, color: item.color, quantity: item.quantity, total: item.product.price * item.quantity })) });
    const { env } = await getCloudflareContext({ async: true });
    const statements = [env.DB.prepare(`INSERT INTO "Order" ("id","orderCode","email","name","address","city","state","zip","country","phone","whatsapp","deliveryInfo","userId","checkoutToken","gender","measurementUnit","measurementSnapshot","measurementCapturedAt","subtotal","shipping","total","status","paymentMethod","paymentStatus","notes","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(orderId, orderCode, user.email, user.name, user.address, user.city, user.state, user.zip || "", "NG", user.phone, user.whatsapp, user.deliveryInfo, user.id, body.checkoutToken, user.gender, user.measurementUnit, snapshot, now, subtotal, 0, subtotal, "pending", "whatsapp", "pending", message, now, now), ...normalized.map((item) => env.DB.prepare(`INSERT INTO "OrderItem" ("id","orderId","productId","quantity","size","color","price") VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), orderId, item.productId, item.quantity, item.size, item.color, item.product.price))];
    try { await env.DB.batch(statements); } catch (error) {
      const existing = await prisma.order.findUnique({ where: { checkoutToken: body.checkoutToken }, select: { orderCode: true, userId: true, notes: true } });
      if (existing?.userId === user.id) return Response.json({ id: existing.orderCode, whatsappUrl: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(existing.notes || "")}` });
      if (error instanceof Error && /stock/i.test(error.message)) return Response.json({ error: "An item just sold out. Please review your cart." }, { status: 409 });
      throw error;
    }
    return Response.json({ id: orderCode, whatsappUrl: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not place order." }, { status: 500 });
  }
}
