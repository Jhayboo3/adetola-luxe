// NGN amounts are calculated in integer kobo. Existing REAL database columns
// remain for compatibility until historical rows have been reconciled.
export function parseNairaToKobo(value: string): number {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Enter a valid amount with at most two decimal places.");
  const minor = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount is too large.");
  return Number(minor);
}

export function nairaToKobo(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid stored amount.");
  const scaled = value * 100;
  const minor = Math.round(scaled);
  if (!Number.isSafeInteger(minor) || Math.abs(scaled - minor) > 0.000001) {
    throw new Error("Stored amount cannot be represented exactly in kobo.");
  }
  return minor;
}

export function koboToNaira(minor: number): number {
  if (!Number.isSafeInteger(minor)) throw new Error("Invalid kobo amount.");
  return minor / 100;
}

export function addKobo(a: number, b: number): number {
  const sum = a + b;
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(sum)) throw new Error("Amount is too large.");
  return sum;
}

export function multiplyKobo(unitMinor: number, quantity: number): number {
  const result = unitMinor * quantity;
  if (!Number.isSafeInteger(unitMinor) || !Number.isInteger(quantity) || quantity < 0 || !Number.isSafeInteger(result)) throw new Error("Invalid line amount.");
  return result;
}
