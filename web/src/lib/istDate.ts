/**
 * IST (Asia/Kolkata) date helpers.
 *
 * India is UTC+05:30 with no daylight saving, so shifting an instant by the
 * fixed offset and reading its UTC calendar parts yields the correct IST date.
 * Never use `new Date().toISOString().split('T')[0]` for "today" — that is the
 * UTC calendar date and is wrong in India between 00:00 and 05:30 IST.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Shifted date whose UTC getters (getUTCDate, getUTCDay, …) return IST parts. */
export function toISTDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** Calendar date (YYYY-MM-DD) of the given instant in India. */
export function toISTDateString(date: Date = new Date()): string {
  return toISTDate(date).toISOString().split('T')[0];
}

/** Current calendar date (YYYY-MM-DD) in India. */
export function todayIST(): string {
  return toISTDateString(new Date());
}

/** IST calendar date N days from now (negative for the past). */
export function addDaysIST(days: number, from: Date = new Date()): string {
  return toISTDateString(new Date(from.getTime() + days * 24 * 60 * 60 * 1000));
}
