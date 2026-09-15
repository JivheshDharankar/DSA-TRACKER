import { ProblemRetention } from '../models/Problem.model.js';

export type RecallResult = 'EASY' | 'STRUGGLED' | 'HINT' | 'FORGOT';
export type TimingStatus = 'EARLY' | 'ON_TIME' | 'LATE';

export interface TimingCalculation {
  timingStatus: TimingStatus;
  latenessDays: number; // Always non-negative: absolute calendar day difference
}

export interface CurrentProblemScheduleState {
  repetitionStage: number; // 0 to 9
  intervalDays: number;
  nextReviewDate: Date;
  lastReviewedAt?: Date | null;
  recoveryStage?: number | null; // null if not in recovery; 0, 1, 2, 3 during recovery
  retentionLevel: ProblemRetention;
}

export interface NextScheduleResult {
  newStage: number;
  newIntervalDays: number;
  newNextReviewDate: Date;
  newRetentionLevel: ProblemRetention;
  newRecoveryStage: number | null;
  timingStatus: TimingStatus;
  latenessDays: number;
}

/**
 * Standard progression intervals (Days per stage):
 * Stage 0: 0d (Initial / Just learned)
 * Stage 1: 1d
 * Stage 2: 3d
 * Stage 3: 7d
 * Stage 4: 14d
 * Stage 5: 30d
 * Stage 6: 60d
 * Stage 7: 120d
 * Stage 8: 240d
 * Stage 9: 365d
 */
export const STAGE_INTERVALS: readonly number[] = [0, 1, 3, 7, 14, 30, 60, 120, 240, 365] as const;

/**
 * Short-term recovery sequence for FORGOT:
 * Step 0: 1 day
 * Step 1: 3 days
 * Step 2: 7 days
 * Step 3: 14 days
 */
export const RECOVERY_INTERVALS: readonly number[] = [1, 3, 7, 14] as const;

export class RevisionScheduler {
  /**
   * Calculates calendar-day timing difference between scheduled date and review date.
   * Uses UTC midnight calendar days to guarantee consistent day-based calculation.
   * Lateness is ALWAYS non-negative.
   */
  static calculateTiming(scheduledDate: Date, reviewedDate: Date): TimingCalculation {
    const scheduledUtc = Date.UTC(
      scheduledDate.getUTCFullYear(),
      scheduledDate.getUTCMonth(),
      scheduledDate.getUTCDate()
    );
    const reviewedUtc = Date.UTC(
      reviewedDate.getUTCFullYear(),
      reviewedDate.getUTCMonth(),
      reviewedDate.getUTCDate()
    );

    const diffDays = Math.round((reviewedUtc - scheduledUtc) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { timingStatus: 'ON_TIME', latenessDays: 0 };
    } else if (diffDays > 0) {
      return { timingStatus: 'LATE', latenessDays: diffDays };
    } else {
      return { timingStatus: 'EARLY', latenessDays: Math.abs(diffDays) };
    }
  }

  /**
   * Anchors a new nextReviewDate to the calendar date of the actual review + interval in days.
   */
  static addCalendarDays(anchorDate: Date, daysToAdd: number): Date {
    const nextDate = new Date(anchorDate.getTime());
    nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
    return nextDate;
  }

  /**
   * Pure deterministic scheduler: calculates new stage, interval, retention, and next review date.
   * Recall quality and timing are kept completely independent.
   */
  static calculateNextSchedule(
    currentState: CurrentProblemScheduleState,
    recallResult: RecallResult,
    reviewedAt: Date
  ): NextScheduleResult {
    const { timingStatus, latenessDays } = this.calculateTiming(
      currentState.nextReviewDate,
      reviewedAt
    );

    let newStage = currentState.repetitionStage;
    let newIntervalDays = currentState.intervalDays;
    let newRetentionLevel = currentState.retentionLevel;
    let newRecoveryStage: number | null = currentState.recoveryStage ?? null;

    const isInRecovery = newRecoveryStage !== null && newRecoveryStage !== undefined;

    switch (recallResult) {
      case 'EASY': {
        if (isInRecovery) {
          // Successful recall in recovery: advance recovery or complete recovery if at or near end
          if (newRecoveryStage! >= RECOVERY_INTERVALS.length - 1) {
            // Exit recovery back to normal stage
            newRecoveryStage = null;
            newStage = Math.min(STAGE_INTERVALS.length - 1, Math.max(1, newStage));
            newIntervalDays = STAGE_INTERVALS[newStage]!;
          } else {
            // Advance recovery sequence
            newRecoveryStage = newRecoveryStage! + 1;
            newIntervalDays = RECOVERY_INTERVALS[newRecoveryStage]!;
          }
        } else {
          // Normal progression: advance stage by 1
          newStage = Math.min(STAGE_INTERVALS.length - 1, newStage + 1);
          newIntervalDays = STAGE_INTERVALS[newStage]!;
        }

        // Retention transition for EASY
        newRetentionLevel = this.promoteRetention(newRetentionLevel, 'EASY');
        break;
      }

      case 'STRUGGLED': {
        if (isInRecovery) {
          // Advance recovery step slowly
          newRecoveryStage = Math.min(RECOVERY_INTERVALS.length - 1, newRecoveryStage! + 1);
          newIntervalDays = RECOVERY_INTERVALS[newRecoveryStage]!;
        } else {
          // Conservative progression: advance stage if at early stages (0 or 1), otherwise hold stage
          if (newStage < 2) {
            newStage = newStage + 1;
          }
          newIntervalDays = STAGE_INTERVALS[newStage]!;
        }

        newRetentionLevel = this.promoteRetention(newRetentionLevel, 'STRUGGLED');
        break;
      }

      case 'HINT': {
        if (isInRecovery) {
          // Hold current recovery step
          newIntervalDays = RECOVERY_INTERVALS[newRecoveryStage!]!;
        } else {
          // Hold stage or drop 1 stage, schedule near review
          newStage = Math.max(1, newStage > 2 ? newStage - 1 : newStage);
          newIntervalDays = STAGE_INTERVALS[newStage]!;
        }

        newRetentionLevel = this.demoteRetention(newRetentionLevel, 'HINT');
        break;
      }

      case 'FORGOT': {
        // Enters recovery sequence at step 0 (1 day)
        // Does NOT erase baseline stage (preserves historical learning)
        newRecoveryStage = 0;
        newIntervalDays = RECOVERY_INTERVALS[0]!; // 1 day
        newRetentionLevel = 'Learning';
        break;
      }
    }

    const newNextReviewDate = this.addCalendarDays(reviewedAt, newIntervalDays);

    return {
      newStage,
      newIntervalDays,
      newNextReviewDate,
      newRetentionLevel,
      newRecoveryStage,
      timingStatus,
      latenessDays,
    };
  }

  private static promoteRetention(current: ProblemRetention, quality: 'EASY' | 'STRUGGLED'): ProblemRetention {
    if (current === 'Locked') return 'Locked';

    if (quality === 'EASY') {
      switch (current) {
        case 'Learning':
          return 'Familiar';
        case 'Familiar':
          return 'Independent';
        case 'Independent':
          return 'Strong';
        case 'Strong':
          return 'Strong';
        default:
          return 'Familiar';
      }
    } else {
      // STRUGGLED promotes conservatively
      switch (current) {
        case 'Learning':
          return 'Familiar';
        case 'Familiar':
          return 'Familiar';
        case 'Independent':
          return 'Independent';
        case 'Strong':
          return 'Strong';
        default:
          return 'Learning';
      }
    }
  }

  private static demoteRetention(current: ProblemRetention, _quality: 'HINT'): ProblemRetention {
    if (current === 'Locked') return 'Locked';

    switch (current) {
      case 'Strong':
        return 'Independent';
      case 'Independent':
        return 'Familiar';
      case 'Familiar':
        return 'Learning';
      case 'Learning':
        return 'Learning';
      default:
        return 'Learning';
    }
  }
}
