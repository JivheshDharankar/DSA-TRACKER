/**
 * DSA Tracker — Calendar-day (UTC) utilities
 * =========================================
 * The application defines a "day" as a **UTC calendar day**. Both the review
 * scheduler (`RevisionScheduler.calculateTiming`, interval anchoring), the review
 * queue predicates and the dashboard day boundaries must agree on that, otherwise
 * a problem can be reported as "due today" while being invisible to the queue.
 *
 * These helpers are the single place that converts an instant into a day boundary.
 * Callers must not re-implement UTC midnight with local-time arithmetic.
 */

/** 00:00:00.000 UTC of the UTC calendar day that contains `date`. */
export const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

/**
 * 00:00:00.000 UTC of the calendar day `days` calendar days after the one containing `date`.
 * Out-of-range days roll over correctly (Oct 31 + 1 → Nov 1, Dec 31 + 1 → Jan 1).
 */
export const startOfUtcDayAfter = (date: Date, days: number): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, 0, 0, 0, 0));

/**
 * 00:00:00.000 UTC of the day after the one containing `date`.
 * This is the first instant at which `date`'s calendar day is no longer current.
 */
export const startOfNextUtcDay = (date: Date): Date => startOfUtcDayAfter(date, 1);

/** The last instant (23:59:59.999 UTC) of the UTC calendar day that contains `date`. */
export const endOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
