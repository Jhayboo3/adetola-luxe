export const CHECKOUT_ATTEMPT_KEY = "larkvine.checkoutAttempt.v1";

type AttemptStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export async function checkoutAttemptToken(store: AttemptStore, payload: unknown, candidateToken: string): Promise<string | null> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const payloadHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  let attempt: { token?: string; payloadHash?: string } | null = null;
  try {
    const saved = store.getItem(CHECKOUT_ATTEMPT_KEY);
    attempt = saved ? JSON.parse(saved) : null;
  } catch {
    store.removeItem(CHECKOUT_ATTEMPT_KEY);
  }
  if (attempt?.payloadHash && attempt.payloadHash !== payloadHash) return null;
  const token = attempt?.payloadHash === payloadHash && typeof attempt.token === "string" ? attempt.token : candidateToken;
  store.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify({ token, payloadHash }));
  return token;
}

export function clearCheckoutAttempt(store: AttemptStore) {
  store.removeItem(CHECKOUT_ATTEMPT_KEY);
}
