import { describe, it, expect, vi } from 'vitest';
import {
  formatCalendarDate,
  formatTiming,
  getDueBadgeInfo,
  toInputDateString,
} from '../../src/utils/date.utils';

describe('Date Utilities — Calendar Timezone Correctness & Formatting', () => {
  describe('formatCalendarDate', () => {
    it('formats a timestamp 1 second after UTC midnight strictly using UTC date semantics', () => {
      // In negative UTC offset timezones (e.g. UTC-7, UTC-4), this would display as Sep 13 without timeZone: 'UTC'
      const dateStr = '2026-09-14T00:00:01.000Z';
      const formatted = formatCalendarDate(dateStr);
      expect(formatted).toBe('Sep 14, 2026');
    });

    it('formats a timestamp 1 second before UTC midnight of the next day strictly using UTC date semantics', () => {
      // In positive UTC offset timezones (e.g. UTC+5:30, UTC+9), this would display as Sep 15 without timeZone: 'UTC'
      const dateStr = '2026-09-14T23:59:59.000Z';
      const formatted = formatCalendarDate(dateStr);
      expect(formatted).toBe('Sep 14, 2026');
    });

    it('preserves exact UTC calendar date at exact UTC midnight across year boundary', () => {
      expect(formatCalendarDate('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026');
      expect(formatCalendarDate('2025-12-31T23:59:59.999Z')).toBe('Dec 31, 2025');
    });

    it('explicitly passes timeZone: "UTC" into toLocaleDateString', () => {
      const spy = vi.spyOn(Date.prototype, 'toLocaleDateString');
      formatCalendarDate('2026-06-15T10:30:00.000Z');

      expect(spy).toHaveBeenCalled();
      const options = spy.mock.calls[0]?.[1];
      expect(options).toBeDefined();
      expect(options?.timeZone).toBe('UTC');
      expect(options?.month).toBe('short');
      expect(options?.day).toBe('numeric');
      expect(options?.year).toBe('numeric');

      spy.mockRestore();
    });

    it('handles invalid date string without throwing an unhandled exception', () => {
      expect(() => formatCalendarDate('not-a-date')).not.toThrow();
      expect(typeof formatCalendarDate('not-a-date')).toBe('string');
    });
  });

  describe('formatTiming', () => {
    it('returns "On time" for ON_TIME or 0 latenessDays', () => {
      expect(formatTiming('ON_TIME', 0)).toBe('On time');
      expect(formatTiming('LATE', 0)).toBe('On time');
    });

    it('returns singular "Late by 1 day" and plural "Late by X days"', () => {
      expect(formatTiming('LATE', 1)).toBe('Late by 1 day');
      expect(formatTiming('LATE', 14)).toBe('Late by 14 days');
    });

    it('returns singular "Early by 1 day" and plural "Early by X days"', () => {
      expect(formatTiming('EARLY', 1)).toBe('Early by 1 day');
      expect(formatTiming('EARLY', 3)).toBe('Early by 3 days');
    });
  });

  describe('getDueBadgeInfo', () => {
    it('correctly categorizes due today, overdue, and upcoming dates', () => {
      const now = new Date();
      const todayStr = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      ).toISOString();

      const overdueStr = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2)
      ).toISOString();

      const futureStr = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 3)
      ).toISOString();

      const todayBadge = getDueBadgeInfo(todayStr);
      expect(todayBadge.isToday).toBe(true);
      expect(todayBadge.label).toBe('Due today');

      const overdueBadge = getDueBadgeInfo(overdueStr);
      expect(overdueBadge.isOverdue).toBe(true);
      expect(overdueBadge.label).toBe('Late by 2 days');

      const futureBadge = getDueBadgeInfo(futureStr);
      expect(futureBadge.isOverdue).toBe(false);
      expect(futureBadge.label).toBe('Due in 3 days');
    });
  });

  describe('toInputDateString', () => {
    it('formats a date into YYYY-MM-DD input format', () => {
      expect(toInputDateString(new Date('2026-09-22T14:30:00.000Z'))).toBe('2026-09-22');
      expect(toInputDateString('2026-09-22T00:00:00.000Z')).toBe('2026-09-22');
    });

    it('handles invalid date input by returning fallback valid date string without crashing', () => {
      const result = toInputDateString('invalid-date');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
