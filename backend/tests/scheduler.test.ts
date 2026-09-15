import { describe, it, expect } from 'vitest';
import {
  RevisionScheduler,
  CurrentProblemScheduleState,
  STAGE_INTERVALS,
  RECOVERY_INTERVALS,
} from '../src/services/revisionScheduler.js';

describe('RevisionScheduler Unit Tests', () => {
  describe('Calendar-Day Timing Calculation', () => {
    it('returns ON_TIME and latenessDays = 0 when reviewed on the same calendar day', () => {
      const scheduled = new Date('2026-09-14T08:00:00Z');
      const reviewed = new Date('2026-09-14T20:30:00Z');

      const result = RevisionScheduler.calculateTiming(scheduled, reviewed);
      expect(result.timingStatus).toBe('ON_TIME');
      expect(result.latenessDays).toBe(0);
    });

    it('returns LATE and non-negative latenessDays = 1 when reviewed 1 calendar day later', () => {
      const scheduled = new Date('2026-09-14T10:00:00Z');
      const reviewed = new Date('2026-09-15T02:00:00Z');

      const result = RevisionScheduler.calculateTiming(scheduled, reviewed);
      expect(result.timingStatus).toBe('LATE');
      expect(result.latenessDays).toBe(1);
    });

    it('returns LATE and non-negative latenessDays = 15 when reviewed 15 calendar days later', () => {
      const scheduled = new Date('2026-09-14T12:00:00Z');
      const reviewed = new Date('2026-09-29T09:00:00Z');

      const result = RevisionScheduler.calculateTiming(scheduled, reviewed);
      expect(result.timingStatus).toBe('LATE');
      expect(result.latenessDays).toBe(15);
    });

    it('returns EARLY and non-negative latenessDays = 2 when reviewed 2 calendar days early', () => {
      const scheduled = new Date('2026-09-14T12:00:00Z');
      const reviewed = new Date('2026-09-12T15:00:00Z');

      const result = RevisionScheduler.calculateTiming(scheduled, reviewed);
      expect(result.timingStatus).toBe('EARLY');
      expect(result.latenessDays).toBe(2);
    });
  });

  describe('Adaptive Progression Outcomes', () => {
    const baseState: CurrentProblemScheduleState = {
      repetitionStage: 0,
      intervalDays: 0,
      nextReviewDate: new Date('2026-09-14T00:00:00Z'),
      retentionLevel: 'Learning',
    };

    it('EASY advances stage + 1 and promotes retention', () => {
      const reviewedAt = new Date('2026-09-14T10:00:00Z');
      const result = RevisionScheduler.calculateNextSchedule(baseState, 'EASY', reviewedAt);

      expect(result.newStage).toBe(1);
      expect(result.newIntervalDays).toBe(STAGE_INTERVALS[1]); // 1 day
      expect(result.newRetentionLevel).toBe('Familiar');
      expect(result.timingStatus).toBe('ON_TIME');
      expect(result.latenessDays).toBe(0);

      // Verify nextReviewDate is anchored to reviewedAt + 1 day
      const expectedDate = new Date('2026-09-15T10:00:00Z');
      expect(result.newNextReviewDate.toISOString()).toBe(expectedDate.toISOString());
    });

    it('Late EASY preserves recallResult and does NOT downgrade to failure', () => {
      const reviewedAt = new Date('2026-09-17T10:00:00Z'); // 3 days late
      const result = RevisionScheduler.calculateNextSchedule(
        { ...baseState, repetitionStage: 3, intervalDays: 7 },
        'EASY',
        reviewedAt
      );

      expect(result.newStage).toBe(4);
      expect(result.newIntervalDays).toBe(14); // Stage 4 is 14 days
      expect(result.timingStatus).toBe('LATE');
      expect(result.latenessDays).toBe(3);

      // Next review anchored to Sep 17 + 14 days = Oct 1
      const expectedDate = new Date('2026-10-01T10:00:00Z');
      expect(result.newNextReviewDate.toISOString()).toBe(expectedDate.toISOString());
    });

    it('STRUGGLED progresses conservatively', () => {
      const reviewedAt = new Date('2026-09-14T10:00:00Z');
      const stateAtStage3: CurrentProblemScheduleState = {
        repetitionStage: 3,
        intervalDays: 7,
        nextReviewDate: new Date('2026-09-14T00:00:00Z'),
        retentionLevel: 'Independent',
      };
      const result = RevisionScheduler.calculateNextSchedule(stateAtStage3, 'STRUGGLED', reviewedAt);

      expect(result.newStage).toBe(3); // Conservative: holds stage 3
      expect(result.newIntervalDays).toBe(7);
      expect(result.newRetentionLevel).toBe('Independent');
    });

    it('HINT moves back or holds stage and schedules near review', () => {
      const reviewedAt = new Date('2026-09-14T10:00:00Z');
      const stateAtStage4: CurrentProblemScheduleState = {
        repetitionStage: 4,
        intervalDays: 14,
        nextReviewDate: new Date('2026-09-14T00:00:00Z'),
        retentionLevel: 'Strong',
      };
      const result = RevisionScheduler.calculateNextSchedule(stateAtStage4, 'HINT', reviewedAt);

      expect(result.newStage).toBe(3);
      expect(result.newIntervalDays).toBe(7);
      expect(result.newRetentionLevel).toBe('Independent');
    });

    it('FORGOT enters recovery sequence at Step 0 without destroying baseline stage', () => {
      const reviewedAt = new Date('2026-09-14T10:00:00Z');
      const stateAtStage5: CurrentProblemScheduleState = {
        repetitionStage: 5,
        intervalDays: 30,
        nextReviewDate: new Date('2026-09-14T00:00:00Z'),
        retentionLevel: 'Strong',
      };
      const result = RevisionScheduler.calculateNextSchedule(stateAtStage5, 'FORGOT', reviewedAt);

      expect(result.newStage).toBe(5); // Preserves baseline stage
      expect(result.newRecoveryStage).toBe(0); // Enters recovery at step 0
      expect(result.newIntervalDays).toBe(RECOVERY_INTERVALS[0]); // 1 day
      expect(result.newRetentionLevel).toBe('Learning');

      // Next review is 1 day later
      const expectedDate = new Date('2026-09-15T10:00:00Z');
      expect(result.newNextReviewDate.toISOString()).toBe(expectedDate.toISOString());
    });

    it('Successful recall during recovery advances through recovery sequence and exits back to normal progression', () => {
      // Problem in recovery at step 0
      const inRecoveryStep0: CurrentProblemScheduleState = {
        repetitionStage: 4,
        intervalDays: 1,
        recoveryStage: 0,
        nextReviewDate: new Date('2026-09-15T00:00:00Z'),
        retentionLevel: 'Learning',
      };

      const rev1 = new Date('2026-09-15T10:00:00Z');
      const res1 = RevisionScheduler.calculateNextSchedule(inRecoveryStep0, 'EASY', rev1);
      expect(res1.newRecoveryStage).toBe(1);
      expect(res1.newIntervalDays).toBe(RECOVERY_INTERVALS[1]); // 3 days

      // Problem in recovery at step 3 (final recovery step) -> next EASY exits recovery
      const inRecoveryStep3: CurrentProblemScheduleState = {
        repetitionStage: 4,
        intervalDays: 14,
        recoveryStage: 3,
        nextReviewDate: new Date('2026-09-30T00:00:00Z'),
        retentionLevel: 'Familiar',
      };

      const rev2 = new Date('2026-09-30T10:00:00Z');
      const res2 = RevisionScheduler.calculateNextSchedule(inRecoveryStep3, 'EASY', rev2);
      expect(res2.newRecoveryStage).toBeNull(); // Recovery completed
      expect(res2.newStage).toBe(4);
      expect(res2.newIntervalDays).toBe(STAGE_INTERVALS[4]); // 14 days
    });
  });
});
