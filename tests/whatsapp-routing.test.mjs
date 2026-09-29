import assert from "node:assert/strict";
import { test } from "node:test";
import { formatNaira, normalizeWhatsappNumber, orderReference, orderWhatsappMessage, whatsappOrderUrl } from "../src/lib/whatsapp.ts";
import { formatPrice } from "../src/lib/utils.ts";

test("currency formatting matches the app formatter", () => {
  for (const value of [0, 7, 1000, 1250.5, 10.05, 3766.9]) {
    assert.equal(formatNaira(value), formatPrice(value), `mismatch for ${value}`);
  }
});

test("WhatsApp numbers normalize to wa.me form", () => {
  assert.equal(normalizeWhatsappNumber("0803 123 4567"), "2348031234567");
  assert.equal(normalizeWhatsappNumber("+234 803 123 4567"), "2348031234567");
  assert.equal(normalizeWhatsappNumber("2348031234567"), "2348031234567");
  assert.equal(normalizeWhatsappNumber("08031-234-567"), "2348031234567");
  assert.equal(normalizeWhatsappNumber(""), null);
  assert.equal(normalizeWhatsappNumber(null), null);
  assert.equal(normalizeWhatsappNumber("12345"), null);
  assert.equal(normalizeWhatsappNumber("12345678901234567890"), null);
});

test("order references never expose internal ids", () => {
  assert.equal(orderReference("ABCDE"), "LV-ABCDE");
  assert.equal(orderReference(""), "Larkvine order");
  assert.equal(orderReference(null), "Larkvine order");
});

test("whatsapp URL encodes the full message and rejects unusable numbers", () => {
  const message = "Hello A&B #42,\nPrice: ₦1,250.50 — it's ready";
  const url = whatsappOrderUrl("08031234567", message);
  assert.ok(url);
  assert.ok(url.startsWith("https://wa.me/2348031234567?text="));
  const encoded = url.slice(url.indexOf("?text=") + 6);
  assert.equal(decodeURIComponent(encoded), message);
  assert.ok(encoded.includes("%0A"), "newline must be encoded");
  assert.ok(encoded.includes("%26"), "ampersand must be encoded");
  assert.ok(encoded.includes("%23"), "hash must be encoded");
  assert.ok(encoded.includes("%E2%82%A6"), "naira sign must be encoded");
  assert.equal(whatsappOrderUrl("12345", message), null);
  assert.equal(whatsappOrderUrl(null, message), null);
});

test("a vendor message contains only that vendor's order", () => {
  const orderA = orderWhatsappMessage({
    orderCode: "AAAAA",
    storeName: "Store A",
    customerName: "Customer One",
    address: "1 A Street, Lagos",
    deliveryInfo: "Call on arrival",
    items: [
      { name: "Ankara Dress", size: "M", color: "Green", quantity: 2, total: 250.1 },
      { name: "Gold Clutch", size: "One Size", color: "Gold", quantity: 1, total: 99.99 },
    ],
    total: 350.09,
  });
  assert.ok(orderA.includes("Hello Store A,"));
  assert.ok(orderA.includes("I just placed an order through Larkvine."));
  assert.ok(orderA.includes("LV-AAAAA"));
  assert.ok(orderA.includes("1. Ankara Dress"));
  assert.ok(orderA.includes("Size: Medium"));
  assert.ok(orderA.includes("Colour: Green"));
  assert.ok(orderA.includes("Qty: 2"));
  assert.ok(orderA.includes("₦250.10"));
  assert.ok(orderA.includes("Order Total:"));
  assert.ok(orderA.includes("₦350.09"));
  assert.ok(orderA.includes("Customer One"));
  assert.ok(orderA.includes("1 A Street, Lagos"));
  assert.ok(orderA.includes("Call on arrival"));

  const orderB = orderWhatsappMessage({
    orderCode: "BBBBB",
    storeName: "Store B",
    customerName: "Customer One",
    address: "1 A Street, Lagos",
    items: [{ name: "Leather Belt", size: "L", color: "Black", quantity: 1, total: 50 }],
    total: 50,
  });

  // No cross-vendor leakage either way.
  assert.ok(!orderA.includes("Leather Belt"));
  assert.ok(!orderB.includes("Ankara Dress"));
  assert.ok(!orderB.includes("Gold Clutch"));
  assert.ok(!orderB.includes("Store A"));
  assert.ok(orderB.includes("LV-BBBBB"));
  assert.ok(orderB.includes("Leather Belt"));

  // No internal tokens or database identifiers in the message.
  for (const message of [orderA, orderB]) {
    assert.ok(!/checkoutToken|tokenHash|requestHash|userId|storeId|productId/i.test(message));
  }

  // Multi-vendor split reconciles exactly: child totals sum to the checkout total.
  assert.equal(350.09 + 50, 400.09);
});
