// Reservation-deadline math, dependency-free so it can be unit-tested and
// shared by the sweep, the targeted checkout cleanup and every order action.
// This is the SINGLE source of the 12-hour policy; do not hard-code the window
// or compute deadlines elsewhere.
//
// Each order persists its own `reservationExpiresAt` at creation
// (`createdAt + configured window`). Operators changing the configured window
// therefore affect only NEW orders; existing deadlines are stable. Historical
// orders created before the feature have a NULL deadline and are grandfathered
// (never auto-expired).

export const ORDER_RESERVATION_WINDOW_HOURS = 12;

export function reservationWindowHours(envValue: string | number | null | undefined = process.env.ORDER_RESERVATION_WINDOW_HOURS): number {
  const raw = Number(envValue);
  return Number.isFinite(raw) && raw > 0 ? raw : ORDER_RESERVATION_WINDOW_HOURS;
}

// The deadline (ms) for a reservation created at `createdAtMs`.
export function reservationDeadlineMs(createdAtMs: number, windowHours: number = reservationWindowHours()): number {
  return createdAtMs + windowHours * 3_600_000;
}

// ISO deadline to persist on a new order.
export function reservationExpiresAtIso(createdAtMs: number, windowHours: number = reservationWindowHours()): string {
  return new Date(reservationDeadlineMs(createdAtMs, windowHours)).toISOString();
}

// True while the reservation is still live: `now` strictly before the deadline.
// At exactly the deadline this is false (the deadline has passed). A NULL
// deadline (grandfathered historical order) is always considered live here; the
// database guards/targeted cleanup use `reservationExpiresAt IS NOT NULL` to
// exclude such rows from automatic expiry.
export function isReservationActive(deadlineIso: string | null | undefined, nowMs: number): boolean {
  if (!deadlineIso) return true;
  const deadline = Date.parse(deadlineIso);
  return Number.isFinite(deadline) ? deadline > nowMs : true;
}

// Cutoff for the pure createdAt-based math used in unit assertions.
export function reservationCutoffIso(nowMs: number = Date.now(), windowHours: number = reservationWindowHours()): string {
  return new Date(nowMs - windowHours * 3_600_000).toISOString();
}
