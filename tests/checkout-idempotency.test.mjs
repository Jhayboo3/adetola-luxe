import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalCheckoutRequest, sha256 } from "../src/lib/checkout-idempotency.ts";

const customer = {
  name: "Audit Customer",
  email: "AUDIT@example.invalid",
  phone: "0000000000",
  whatsapp: "0000000000",
  address: "123 Test Street",
  city: "Lagos",
  state: "Lagos",
  size: "M",
};
const items = [
  { productId: "product-a", quantity: 2, size: "M", color: "Blue" },
  { productId: "product-b", quantity: 1, size: "L" },
];

test("checkout fingerprint ignores object key order and cart line order", async () => {
  const reorderedCustomer = { size: "M", state: "Lagos", city: "Lagos", address: "123 Test Street", whatsapp: "0000000000", phone: "0000000000", email: "audit@example.invalid", name: "Audit Customer" };
  const first = await sha256(canonicalCheckoutRequest(items, customer, null));
  const second = await sha256(canonicalCheckoutRequest([items[1], items[0]], reorderedCustomer, null));
  assert.equal(first, second);
});

test("checkout fingerprint changes for different cart, delivery, or user", async () => {
  const base = await sha256(canonicalCheckoutRequest(items, customer, null));
  const variants = [
    { items: [{ ...items[0], quantity: 3 }, items[1]], customer, userId: null },
    { items: [{ ...items[0], productId: "product-c" }, items[1]], customer, userId: null },
    { items: [{ ...items[0], productId: "store-b-product" }, items[1]], customer, userId: null },
    { items, customer: { ...customer, address: "Different Street" }, userId: null },
    { items, customer, userId: "customer-1" },
  ];
  for (const variant of variants) {
    assert.notEqual(await sha256(canonicalCheckoutRequest(variant.items, variant.customer, variant.userId)), base);
  }
});
