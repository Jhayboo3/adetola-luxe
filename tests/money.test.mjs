import assert from "node:assert/strict";
import { test } from "node:test";
import { addKobo, koboToNaira, multiplyKobo, nairaToKobo, parseNairaToKobo } from "../src/lib/money.ts";

test("decimal input becomes exact integer kobo", () => {
  assert.equal(parseNairaToKobo("1250.50"), 125050);
  assert.equal(parseNairaToKobo("0.05"), 5);
  assert.equal(parseNairaToKobo("100"), 10000);
  assert.throws(() => parseNairaToKobo("1.005"));
  assert.throws(() => parseNairaToKobo("-1"));
});

test("line, shipping, discount and multi-store totals use integer arithmetic", () => {
  const storeA = multiplyKobo(parseNairaToKobo("1250.50"), 3);
  const storeB = multiplyKobo(parseNairaToKobo("0.10"), 2);
  const shipping = parseNairaToKobo("20.25");
  const discount = parseNairaToKobo("5.05");
  assert.equal(storeA, 375150);
  assert.equal(addKobo(addKobo(storeA, storeB), shipping) - discount, 376690);
  assert.equal(koboToNaira(376690), 3766.9);
});

test("legacy REAL amounts are accepted only when unambiguous to kobo", () => {
  assert.equal(nairaToKobo(0.1 + 0.2), 30);
  assert.equal(nairaToKobo(1250.5), 125050);
  assert.throws(() => nairaToKobo(1.005));
  assert.throws(() => nairaToKobo(Number.POSITIVE_INFINITY));
});
