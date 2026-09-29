// Reservation-deadline math, dependency-free so it can be unit-tested and
// shared by the sweep and every order action. This is the SINGLE source of the
// 12-hour policy; do not hard-code the window or compute deadlines elsewhere.
//
// An unaccepted reservation is valid for `ORDER_RESERVATION_WINDOW_HOURS` from
// Order.createdAt. Vendor acceptance is valid only strictly before the deadline;
// at or after the deadline the order is stale and must expire, regardless of
// whether the opportunistic sweep has run yet.

export const ORDER_RESERVATION_WINDOW_HOURS = 12;

export function reservationWindowHours(envValue: string | number | null | undefined = process.env.ORDER_RESERVATION_WINDOW_HOURS): number {
  const raw = Number(envValue);
  return Number.isFinite(raw) && raw > 0 ? raw : ORDER_RESERVATION_WINDOW_HOURS;
}

// The deadline for a reservation created at `createdAtMs`.
export function reservationDeadlineMs(createdAtMs: number, windowHours: number = reservationWindowHours()): number {
  return createdAtMs + windowHours * 3_600_000;
}

// True only while the reservation is still live: `now` strictly before the
// deadline. At exactly the deadline this is false (the deadline has passed).
export function isReservationActive(createdAtMs: number, nowMs: number, windowHours: number = reservationWindowHours()): boolean {
  return reservationDeadlineMs(createdAtMs, windowHours) > nowMs;
}

// ISO cutoff such that `createdAt > cutoff` ⇔ reservation still active.
export function reservationCutoffIso(nowMs: number = Date.now(), windowHours: number = reservationWindowHours()): string {
  return new Date(nowMs - windowHours * 3_600_000).toISOString();
}
