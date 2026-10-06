import { TimingStatusType } from '../types';

/**
 * Formats user-facing punctuality string strictly in days (never hours/minutes).
 * Examples: "On time", "Late by 1 day", "Late by 15 days", "Early by 2 days"
 */
export const formatTiming = (timingStatus: TimingStatusType, latenessDays: number): string => {
  const days = Math.abs(latenessDays);
  if (timingStatus === 'ON_TIME' || days === 0) {
    return 'On time';
  }
  if (timingStatus === 'LATE') {
    return days === 1 ? 'Late by 1 day' : `Late by ${days} days`;
  }
  if (timingStatus === 'EARLY') {
    return days === 1 ? 'Early by 1 day' : `Early by ${days} days`;
  }
  return 'On time';
};

/**
 * Calculates calendar day status for a due review date compared to today.
 */
export const getDueBadgeInfo = (
  nextReviewDateStr: string
): { label: string; isOverdue: boolean; isToday: boolean; daysDiff: number } => {
  const nextDate = new Date(nextReviewDateStr);
  const now = new Date();

  const nextUtc = Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate());
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const diffDays = Math.round((nowUtc - nextUtc) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { label: 'Due today', isOverdue: false, isToday: true, daysDiff: 0 };
  } else if (diffDays > 0) {
    return {
      label: diffDays === 1 ? 'Late by 1 day' : `Late by ${diffDays} days`,
      isOverdue: true,
      isToday: false,
      daysDiff: diffDays,
    };
  } else {
    const daysUntil = Math.abs(diffDays);
    return {
      label: daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil} days`,
      isOverdue: false,
      isToday: false,
      daysDiff: diffDays,
    };
  }
};

/**
 * Formats a date string into a clean readable format: "Sep 14, 2026"
 */
export const formatCalendarDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Formats a Date instance or ISO date string into an HTML date input format: "YYYY-MM-DD"
 */
export const toInputDateString = (date: Date | string = new Date()): string => {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return new Date().toISOString().slice(0, 10);
    }
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};
