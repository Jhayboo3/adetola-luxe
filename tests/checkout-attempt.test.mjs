import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { checkoutAttemptToken, clearCheckoutAttempt, CHECKOUT_ATTEMPT_KEY } from "../src/lib/checkout-attempt.ts";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("reload, back navigation and retry retain the token for an identical checkout", async () => {
  const tab = storage();
  const payload = { items: [{ productId: "a", quantity: 1 }], customer: { address: "Lagos" } };
  const first = await checkoutAttemptToken(tab, payload, randomUUID());
  const afterReload = await checkoutAttemptToken(tab, payload, randomUUID());
  const afterBackNavigation = await checkoutAttemptToken(tab, payload, randomUUID());
  assert.equal(afterReload, first);
  assert.equal(afterBackNavigation, first);
  assert.equal(await checkoutAttemptToken(tab, { ...payload, items: [{ productId: "a", quantity: 2 }] }, randomUUID()), null);
  clearCheckoutAttempt(tab);
  assert.equal(tab.getItem(CHECKOUT_ATTEMPT_KEY), null);
  assert.notEqual(await checkoutAttemptToken(tab, payload, randomUUID()), first);
});
