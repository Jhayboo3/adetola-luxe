import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { displayColor, parseJsonArray } from "@/lib/utils";
import { isGarmentSize } from "@/lib/measurements";
import { storeWhatsappFromRecord, vendorHasContact } from "@/lib/store";
import { ORDER_STATUS_SENT_TO_WHATSAPP } from "@/lib/orders";
import { orderWhatsappMessage, whatsappOrderUrl } from "@/lib/whatsapp";
import { canonicalCheckoutRequest, sha256, type CheckoutRequestCustomer, type CheckoutRequestItem } from "@/lib/checkout-idempotency";
import { addKobo, koboToNaira, multiplyKobo, nairaToKobo } from "@/lib/money";

type CheckoutItem = CheckoutRequestItem;
type Customer = CheckoutRequestCustomer;

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
  // Only surface a WhatsApp handoff when the seller actually supplied a
  // contact number. Otherwise the client shows a support path instead of
  // silently routing the customer to the platform fallback number.
  return { store: store.name, orderCode, id, whatsappUrl: vendorHasContact(store) ? whatsappOrderUrl(storeWhatsappFromRecord(store), message) : null };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = await request.json() as { checkoutToken?: string; items?: CheckoutItem[]; customer?: Customer };
    if (!body || typeof body.checkoutToken !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.checkoutToken) || !Array.isArray(body.items) || !body.items.length || body.items.length > 50) return Response.json({ error: "Invalid checkout request." }, { status: 400 });
    const customer = body.customer;
    if (!customer || typeof customer !== "object") return Response.json({ error: "Please complete your contact and delivery details." }, { status: 422 });
    if (!isGarmentSize(customer.size)) return Response.json({ error: "Choose a garment size (L, M, XL, XXL, XXXL)." }, { status: 422 });
    const required = ["name", "phone", "whatsapp", "email", "address", "city", "state"] as const;
    for (const field of required) if (typeof customer[field] !== "string" || !customer[field].trim() || customer[field].length > 500) return Response.json({ error: "Please complete all contact and delivery fields." }, { status: 422 });
    for (const field of ["gender", "zip", "deliveryInfo"] as const) if (customer[field] != null && (typeof customer[field] !== "string" || customer[field].length > 1000)) return Response.json({ error: "Invalid delivery details." }, { status: 422 });

    const requested = body.items.filter((item) => item && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100 && typeof item.productId === "string" && item.productId.length <= 100 && (item.size == null || typeof item.size === "string") && (item.color == null || typeof item.color === "string"));
    if (requested.length !== body.items.length) return Response.json({ error: "Invalid cart quantity." }, { status: 400 });
    const ownerId = session?.user?.id ?? null;
    const checkoutEmail = customer.email.trim().toLowerCase();
    const tokenHash = await sha256(body.checkoutToken);
    const requestHash = await sha256(canonicalCheckoutRequest(requested, customer, ownerId));

    const replayCheckout = async () => {
      const checkout = await prisma.checkout.findUnique({
        where: { tokenHash },
        include: { orders: { include: { store: { select: { id: true, name: true, whatsapp: true, phone: true, owner: { select: { whatsapp: true, phone: true } } } } } } },
      });
      if (!checkout) return null;
      if (checkout.requestHash !== requestHash || checkout.userId !== ownerId || checkout.email !== checkoutEmail) {
        return Response.json({ error: "This checkout token was already used for a different request." }, { status: 409 });
      }
      if (!checkout.orders.length) return Response.json({ error: "Checkout is still being processed. Please retry." }, { status: 503 });
      const orders = checkout.orders.sort((a, b) => a.storeId < b.storeId ? -1 : a.storeId > b.storeId ? 1 : 0);
      return Response.json({ checkoutId: checkout.id, whatsapps: orders.map((order) => whatsappResult(order.store, order.orderCode || "", order.id, order.notes || `New order #${order.orderCode || ""}`)) });
    };

    const replay = await replayCheckout();
    if (replay) return replay;
    // Older orders were created before a token was bound to a request. A retry
    // with such a token cannot be proven identical, so reject it safely.
    if (await prisma.order.findFirst({ where: { checkoutToken: body.checkoutToken }, select: { id: true } })) {
      return Response.json({ error: "This checkout was started before the latest update. Please start a new checkout." }, { status: 409 });
    }
    const ids = [...new Set(requested.map((item) => item.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: ids }, published: true, stock: { gt: 0 }, store: { status: "approved" } }, include: { store: { select: { id: true, name: true, slug: true, whatsapp: true, phone: true, owner: { select: { whatsapp: true, phone: true } } } } } });
    if (products.length !== ids.length) return (await replayCheckout()) ?? Response.json({ error: "One or more cart items are sold out or unavailable." }, { status: 409 });
    const byId = new Map(products.map((product) => [product.id, product]));

    for (const [id, quantity] of requested.reduce((m, i) => m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity), new Map<string, number>())) {
      const product = byId.get(id)!;
      if (product.stock < quantity) return (await replayCheckout()) ?? Response.json({ error: `${product.name} does not have enough stock.` }, { status: 409 });
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
      let unitMinor = 0;
      try {
        const legacyMinor = nairaToKobo(product.price);
        unitMinor = product.priceMinor == null ? legacyMinor : Number(product.priceMinor);
        if (!Number.isSafeInteger(unitMinor) || unitMinor !== legacyMinor) throw new Error("Product price snapshots disagree.");
        if (unitMinor <= 0) throw new Error("Price must be positive.");
      } catch {
        validationError.push(`The price for ${product.name} needs review. Please contact the store.`);
      }
      return { ...item, size, color, product, unitMinor };
    });
    if (validationError.length) return (await replayCheckout()) ?? Response.json({ error: validationError[0] }, { status: 422 });

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

    // The checkout identity and all vendor orders commit in one D1 batch.
    // A second request with the same token can only replay the complete result.
    const checkoutId = crypto.randomUUID();
    const statements: ReturnType<typeof env.DB.prepare>[] = [
      env.DB.prepare('INSERT INTO "Checkout" ("id","tokenHash","requestHash","userId","email","currency","createdAt") VALUES (?,?,?,?,?,?,?)').bind(checkoutId, tokenHash, requestHash, ownerId, checkoutEmail, "NGN", now),
    ];
    const createdMeta: { storeId: string; order: { id: string; orderCode: string; store: { name: string; whatsapp?: string | null; phone?: string | null; owner?: { whatsapp?: string | null; phone?: string | null } | null }; message: string } }[] = [];
    for (const [storeId, items] of groups) {
      const store = byId.get(items[0].product.id)!.store;
      const subtotalMinor = items.reduce((sum, item) => addKobo(sum, multiplyKobo(item.unitMinor, item.quantity)), 0);
      const subtotal = koboToNaira(subtotalMinor);
      const orderCode = await createOrderCode(storeId);
      const orderId = crypto.randomUUID();
      const message = orderWhatsappMessage({
        orderCode,
        storeName: store.name,
        customerName: customer.name,
        address,
        deliveryInfo: customer.deliveryInfo ?? "",
        items: items.map((item) => ({ name: item.product.name, size: item.size, color: item.color, quantity: item.quantity, total: koboToNaira(multiplyKobo(item.unitMinor, item.quantity)) })),
        total: subtotal,
      });
      createdMeta.push({ storeId, order: { id: orderId, orderCode, store, message } });
      statements.push(
        env.DB.prepare(`INSERT INTO "Order" ("id","checkoutId","storeId","orderCode","email","name","address","city","state","zip","country","phone","whatsapp","deliveryInfo","userId","checkoutToken","gender","size","measurementUnit","measurementSnapshot","measurementCapturedAt","subtotal","currency","subtotalMinor","shipping","shippingMinor","discountMinor","total","totalMinor","status","paymentMethod","paymentStatus","notes","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(orderId, checkoutId, storeId, orderCode, customer.email, customer.name, customer.address, customer.city, customer.state, customer.zip || "", "NG", customer.phone, customer.whatsapp, customer.deliveryInfo ?? "", ownerId, null, gender, customer.size, null, "{}", null, subtotal, "NGN", subtotalMinor, 0, 0, null, subtotal, subtotalMinor, ORDER_STATUS_SENT_TO_WHATSAPP, "whatsapp", "pending", message, now, now),
        ...items.map((item) => env.DB.prepare(`INSERT INTO "OrderItem" ("id","storeId","orderId","productId","quantity","size","color","price","priceMinor") VALUES (?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), storeId, orderId, item.productId, item.quantity, item.size, item.color, koboToNaira(item.unitMinor), item.unitMinor))
      );
    }

    try {
      await env.DB.batch(statements);
    } catch (error) {
      const raced = await replayCheckout();
      if (raced) return raced;
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (/stock/i.test(message)) return Response.json({ error: "An item just sold out. Please review your cart." }, { status: 409 });
      if (/Product or store unavailable/i.test(message)) return Response.json({ error: "An item or store is no longer available. Please review your cart." }, { status: 409 });
      throw error;
    }

    const results = createdMeta.sort((a, b) => a.storeId < b.storeId ? -1 : a.storeId > b.storeId ? 1 : 0)
      .map(({ order }) => whatsappResult(order.store, order.orderCode, order.id, order.message));

    return Response.json({ checkoutId, whatsapps: results });
  } catch (error) {
    console.error("Order creation failed", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ error: "Could not place order. Please try again." }, { status: 500 });
  }
}
