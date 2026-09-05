import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { displayColor, formatPrice, parseJsonArray } from "@/lib/utils";
import { isGarmentSize } from "@/lib/measurements";
import { storeWhatsappFromRecord } from "@/lib/store";
import { ORDER_STATUS_SENT_TO_WHATSAPP } from "@/lib/orders";

type CheckoutItem = { productId: string; quantity: number; size: string; color?: string };
type Customer = {
  name: string; email: string; phone: string; whatsapp: string;
  gender?: string; address: string; city: string; state: string; zip?: string;
  deliveryInfo?: string; size: string;
};
const sizeNames: Record<string, string> = { XS: "Extra Small", S: "Small", M: "Medium", L: "Large", XL: "Extra Large", XXL: "Double Extra Large", XXXL: "Triple Extra Large" };

function orderWhatsappMessage(order: {
  orderCode: string; storeName: string; customerName: string; address: string; deliveryInfo: string;
  items: { name: string; size: string; color: string; quantity: number; total: number }[]; total: number;
}) {
  const itemSections = order.items.map((item) =>
    [
      `*Product:* ${item.name}`,
      `Size: ${sizeNames[item.size.toUpperCase()] ?? item.size}`,
      `Colour: ${item.color}`,
      `Quantity: ${item.quantity}`,
      `Price: ${formatPrice(item.total)}`,
    ].join("\n")
  );
  return [
    "*NEW ORDER*",
    "",
    `Store: ${order.storeName}`,
    `Order ID: #${order.orderCode}`,
    `Customer Name: ${order.customerName}`,
    "",
    "*ORDER DETAILS*",
    itemSections.join("\n\n"),
    "",
    `Total: ${formatPrice(order.total)}`,
    "Payment to be arranged via WhatsApp",
    "",
    "*DELIVERY ADDRESS*",
    `${order.address}${order.deliveryInfo ? `\n${order.deliveryInfo}` : ""}`,
  ].join("\n");
}

async function createOrderCode(storeId: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    if (!(await prisma.order.findFirst({ where: { orderCode: code, storeId }, select: { id: true } }))) return code;
  }
  throw new Error("Could not generate an order number. Please try again.");
}

function whatsappResult(
  store: { name: string; whatsapp?: string | null; phone?: string | null; owner?: { whatsapp?: string | null; phone?: string | null } | null },
  orderCode: string,
  id: string,
  message: string,
) {
  return { store: store.name, orderCode, id, whatsappUrl: `https://wa.me/${storeWhatsappFromRecord(store)}?text=${encodeURIComponent(message)}` };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = await request.json() as { checkoutToken?: string; items?: CheckoutItem[]; customer?: Customer };
    if (!body.checkoutToken || !/^[a-zA-Z0-9-]{10,100}$/.test(body.checkoutToken) || !body.items?.length) return Response.json({ error: "Invalid checkout request." }, { status: 400 });
    const customer = body.customer;
    if (!customer) return Response.json({ error: "Please complete your contact and delivery details." }, { status: 422 });
    if (!isGarmentSize(customer.size)) return Response.json({ error: "Choose a garment size (L, M, XL, XXL, XXXL)." }, { status: 422 });
    const required = ["name", "phone", "whatsapp", "email", "address", "city", "state"] as const;
    for (const field of required) if (!customer[field]?.trim()) return Response.json({ error: "Please complete all contact and delivery fields." }, { status: 422 });

    const requested = body.items.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0 && typeof item.productId === "string");
    if (requested.length !== body.items.length) return Response.json({ error: "Invalid cart quantity." }, { status: 400 });
    const ids = [...new Set(requested.map((item) => item.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: ids }, published: true, stock: { gt: 0 } }, include: { store: { select: { id: true, name: true, slug: true, whatsapp: true, phone: true, owner: { select: { whatsapp: true, phone: true } } } } } });
    if (products.length !== ids.length) return Response.json({ error: "One or more cart items are sold out or unavailable." }, { status: 409 });
    const byId = new Map(products.map((product) => [product.id, product]));

    for (const [id, quantity] of requested.reduce((m, i) => m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity), new Map<string, number>())) {
      const product = byId.get(id)!;
      if (product.stock < quantity) return Response.json({ error: `${product.name} does not have enough stock.` }, { status: 409 });
    }

    const validationError: string[] = [];
    const normalized = requested.map((item) => {
      const product = byId.get(item.productId)!;
      const sizes = parseJsonArray(product.sizes);
      const size = item.size || "One Size";
      if (sizes.length && !sizes.includes(size)) validationError.push(`Choose an available size for ${product.name}.`);
      let color = "As shown";
      if (product.colorSelectable && parseJsonArray(product.colors).length > 0) {
        color = displayColor(item.color || "");
        if (!parseJsonArray(product.colors).map(displayColor).includes(color)) validationError.push(`Choose an available colour for ${product.name}.`);
      }
      return { ...item, size, color, product };
    });
    if (validationError.length) return Response.json({ error: validationError[0] }, { status: 422 });

    // Group items by store so each vendor gets its own order + WhatsApp message.
    const groups = new Map<string, typeof normalized>();
    for (const item of normalized) {
      const key = item.product.store.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const { env } = await getCloudflareContext({ async: true });
    const now = new Date().toISOString();
    const gender = customer.gender === "Male" || customer.gender === "Female" ? customer.gender : null;
    const address = `${customer.address}, ${customer.city}, ${customer.state}${customer.zip ? `, ${customer.zip}` : ""}`;

    // Idempotency: an interrupted retry may already have created orders for some
    // stores. Never short-circuit and drop the remaining stores — create any that
    // are missing, then return everything together.
    const existing = await prisma.order.findMany({
      where: { checkoutToken: body.checkoutToken },
      include: { store: { select: { id: true, name: true, whatsapp: true, phone: true, owner: { select: { whatsapp: true, phone: true } } } } },
    });
    const existingByStore = new Map(existing.map((order) => [order.storeId, order]));
    const missing = [...groups].filter(([storeId]) => !existingByStore.has(storeId));

    const statements: ReturnType<typeof env.DB.prepare>[] = [];
    const createdMeta: { storeId: string; order: { id: string; orderCode: string; store: { name: string; whatsapp?: string | null; phone?: string | null; owner?: { whatsapp?: string | null; phone?: string | null } | null }; message: string } }[] = [];
    for (const [storeId, items] of missing) {
      const store = byId.get(items[0].product.id)!.store;
      const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const orderCode = await createOrderCode(storeId);
      const orderId = crypto.randomUUID();
      const message = orderWhatsappMessage({
        orderCode,
        storeName: store.name,
        customerName: customer.name,
        address,
        deliveryInfo: customer.deliveryInfo ?? "",
        items: items.map((item) => ({ name: item.product.name, size: item.size, color: item.color, quantity: item.quantity, total: item.product.price * item.quantity })),
        total: subtotal,
      });
      createdMeta.push({ storeId, order: { id: orderId, orderCode, store, message } });
      statements.push(
        env.DB.prepare(`INSERT INTO "Order" ("id","storeId","orderCode","email","name","address","city","state","zip","country","phone","whatsapp","deliveryInfo","userId","checkoutToken","gender","size","measurementUnit","measurementSnapshot","measurementCapturedAt","subtotal","shipping","total","status","paymentMethod","paymentStatus","notes","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(orderId, storeId, orderCode, customer.email, customer.name, customer.address, customer.city, customer.state, customer.zip || "", "NG", customer.phone, customer.whatsapp, customer.deliveryInfo, session?.user?.id ?? null, body.checkoutToken, gender, customer.size, null, "{}", null, subtotal, 0, subtotal, ORDER_STATUS_SENT_TO_WHATSAPP, "whatsapp", "pending", message, now, now),
        ...items.map((item) => env.DB.prepare(`INSERT INTO "OrderItem" ("id","storeId","orderId","productId","quantity","size","color","price") VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), storeId, orderId, item.productId, item.quantity, item.size, item.color, item.product.price))
      );
    }

    if (statements.length) {
      // One D1 batch across all involved stores: D1 batches run in a single
      // transaction, so a stock failure in one store rolls back every store's
      // inserts and stock decrements instead of committing a partial order.
      try {
        await env.DB.batch(statements);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        if (/stock/i.test(message)) return Response.json({ error: "An item just sold out. Please review your cart." }, { status: 409 });
        // A concurrent duplicate submit (same token) can race this one on the
        // (storeId, checkoutToken) unique index. If the orders already exist,
        // return them instead of failing the customer's checkout.
        if (/unique constraint/i.test(message)) {
          const raced = await prisma.order.findMany({
            where: { checkoutToken: body.checkoutToken },
            include: { store: { select: { id: true, name: true, whatsapp: true, phone: true, owner: { select: { whatsapp: true, phone: true } } } } },
          });
          if (raced.length) {
            return Response.json({ whatsapps: raced.map((order) => whatsappResult(order.store, order.orderCode || "", order.id, order.notes || `New order #${order.orderCode || ""}`)) });
          }
        }
        throw error;
      }
    }

    const results = [
      ...existing.map((order) => whatsappResult(order.store, order.orderCode || "", order.id, order.notes || `New order #${order.orderCode || ""}`)),
      ...createdMeta.map(({ order }) => whatsappResult(order.store, order.orderCode, order.id, order.message)),
    ];

    return Response.json({ whatsapps: results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not place order." }, { status: 500 });
  }
}
