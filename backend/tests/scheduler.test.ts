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

  describe('High-Stage Interval Transitions & Stage 9 Terminal Cap', () => {
    it('advances sequentially through high stages: Stage 4 (14d) -> 5 (30d) -> 6 (60d) -> 7 (120d) -> 8 (240d) -> 9 (365d)', () => {
      const baseDate = new Date('2026-01-01T00:00:00Z');

      // Stage 4 -> 5
      const s4: CurrentProblemScheduleState = {
        repetitionStage: 4,
        intervalDays: 14,
        nextReviewDate: baseDate,
        retentionLevel: 'Independent',
      };
      const r5 = RevisionScheduler.calculateNextSchedule(s4, 'EASY', baseDate);
      expect(r5.newStage).toBe(5);
      expect(r5.newIntervalDays).toBe(30);

      // Stage 5 -> 6
      const s5: CurrentProblemScheduleState = {
        repetitionStage: 5,
        intervalDays: 30,
        nextReviewDate: baseDate,
        retentionLevel: 'Independent',
      };
      const r6 = RevisionScheduler.calculateNextSchedule(s5, 'EASY', baseDate);
      expect(r6.newStage).toBe(6);
      expect(r6.newIntervalDays).toBe(60);

      // Stage 6 -> 7
      const s6: CurrentProblemScheduleState = {
        repetitionStage: 6,
        intervalDays: 60,
        nextReviewDate: baseDate,
        retentionLevel: 'Strong',
      };
      const r7 = RevisionScheduler.calculateNextSchedule(s6, 'EASY', baseDate);
      expect(r7.newStage).toBe(7);
      expect(r7.newIntervalDays).toBe(120);

      // Stage 7 -> 8
      const s7: CurrentProblemScheduleState = {
        repetitionStage: 7,
        intervalDays: 120,
        nextReviewDate: baseDate,
        retentionLevel: 'Strong',
      };
      const r8 = RevisionScheduler.calculateNextSchedule(s7, 'EASY', baseDate);
      expect(r8.newStage).toBe(8);
      expect(r8.newIntervalDays).toBe(240);

      // Stage 8 -> 9 (365d)
      const s8: CurrentProblemScheduleState = {
        repetitionStage: 8,
        intervalDays: 240,
        nextReviewDate: baseDate,
        retentionLevel: 'Strong',
      };
      const r9 = RevisionScheduler.calculateNextSchedule(s8, 'EASY', baseDate);
      expect(r9.newStage).toBe(9);
      expect(r9.newIntervalDays).toBe(365);
    });

    it('caps at Stage 9 (365d) indefinitely upon subsequent EASY reviews', () => {
      const reviewDate = new Date('2027-01-01T12:00:00Z');
      const s9: CurrentProblemScheduleState = {
        repetitionStage: 9,
        intervalDays: 365,
        nextReviewDate: reviewDate,
        retentionLevel: 'Strong',
      };

      // 1st subsequent EASY at Stage 9
      const res1 = RevisionScheduler.calculateNextSchedule(s9, 'EASY', reviewDate);
      expect(res1.newStage).toBe(9);
      expect(res1.newIntervalDays).toBe(365);
      expect(res1.newRetentionLevel).toBe('Strong');

      // 2nd subsequent EASY at Stage 9
      const s9Next: CurrentProblemScheduleState = {
        repetitionStage: res1.newStage,
        intervalDays: res1.newIntervalDays,
        nextReviewDate: res1.newNextReviewDate,
        retentionLevel: res1.newRetentionLevel,
      };
      const res2 = RevisionScheduler.calculateNextSchedule(s9Next, 'EASY', res1.newNextReviewDate);
      expect(res2.newStage).toBe(9);
      expect(res2.newIntervalDays).toBe(365);
      expect(res2.newRetentionLevel).toBe('Strong');
    });

    it('STRUGGLED at Stage 9 holds at Stage 9 with 365d interval', () => {
      const reviewDate = new Date('2027-01-01T12:00:00Z');
      const s9: CurrentProblemScheduleState = {
        repetitionStage: 9,
        intervalDays: 365,
        nextReviewDate: reviewDate,
        retentionLevel: 'Strong',
      };

      const res = RevisionScheduler.calculateNextSchedule(s9, 'STRUGGLED', reviewDate);
      expect(res.newStage).toBe(9);
      expect(res.newIntervalDays).toBe(365);
      expect(res.newRetentionLevel).toBe('Strong');
    });

    it('HINT at Stage 9 demotes 1 stage to Stage 8 (240d)', () => {
      const reviewDate = new Date('2027-01-01T12:00:00Z');
      const s9: CurrentProblemScheduleState = {
        repetitionStage: 9,
        intervalDays: 365,
        nextReviewDate: reviewDate,
        retentionLevel: 'Strong',
      };

      const res = RevisionScheduler.calculateNextSchedule(s9, 'HINT', reviewDate);
      expect(res.newStage).toBe(8);
      expect(res.newIntervalDays).toBe(240);
      expect(res.newRetentionLevel).toBe('Independent');
    });
  });

  describe('Boundary Conditions & Lateness Dynamics', () => {
    it('exact on-time review produces ON_TIME and latenessDays = 0', () => {
      const scheduled = new Date('2026-05-10T14:30:00Z');
      const reviewed = new Date('2026-05-10T14:30:00Z');

      const timing = RevisionScheduler.calculateTiming(scheduled, reviewed);
      expect(timing.timingStatus).toBe('ON_TIME');
      expect(timing.latenessDays).toBe(0);
    });

    it('1 calendar day early produces EARLY and latenessDays = 1', () => {
      const scheduled = new Date('2026-05-10T00:00:00Z');
      const reviewed = new Date('2026-05-09T23:59:59Z');

      const timing = RevisionScheduler.calculateTiming(scheduled, reviewed);
      expect(timing.timingStatus).toBe('EARLY');
      expect(timing.latenessDays).toBe(1);
    });

    it('1 calendar day late produces LATE and latenessDays = 1', () => {
      const scheduled = new Date('2026-05-10T23:59:59Z');
      const reviewed = new Date('2026-05-11T00:00:00Z');

      const timing = RevisionScheduler.calculateTiming(scheduled, reviewed);
      expect(timing.timingStatus).toBe('LATE');
      expect(timing.latenessDays).toBe(1);
    });

    it('review 100 days overdue anchors newNextReviewDate to reviewedAt, preventing overdue snowballing', () => {
      const scheduled = new Date('2026-01-01T10:00:00Z');
      const reviewed = new Date('2026-04-11T10:00:00Z'); // Exactly 100 days later

      const state: CurrentProblemScheduleState = {
        repetitionStage: 2,
        intervalDays: 3,
        nextReviewDate: scheduled,
        retentionLevel: 'Familiar',
      };

      const result = RevisionScheduler.calculateNextSchedule(state, 'EASY', reviewed);
      expect(result.timingStatus).toBe('LATE');
      expect(result.latenessDays).toBe(100);
      expect(result.newStage).toBe(3);
      expect(result.newIntervalDays).toBe(7);

      // Anchors to reviewedAt + 7 days = 2026-04-18, NOT scheduled + 7 days = 2026-01-08
      const expectedNext = new Date('2026-04-18T10:00:00Z');
      expect(result.newNextReviewDate.toISOString()).toBe(expectedNext.toISOString());
    });

    it('same-day repeated review calculates ON_TIME and advances forward from second review date', () => {
      const review1 = new Date('2026-06-01T08:00:00Z');
      const state0: CurrentProblemScheduleState = {
        repetitionStage: 0,
        intervalDays: 0,
        nextReviewDate: review1,
        retentionLevel: 'Learning',
      };

      const res1 = RevisionScheduler.calculateNextSchedule(state0, 'EASY', review1);
      expect(res1.newStage).toBe(1);
      expect(res1.newIntervalDays).toBe(1);
      // Next scheduled is 2026-06-02T08:00:00Z

      // Same day second review at 18:00 UTC (1 day early relative to 2026-06-02)
      const review2 = new Date('2026-06-01T18:00:00Z');
      const state1: CurrentProblemScheduleState = {
        repetitionStage: res1.newStage,
        intervalDays: res1.newIntervalDays,
        nextReviewDate: res1.newNextReviewDate,
        retentionLevel: res1.newRetentionLevel,
      };

      const res2 = RevisionScheduler.calculateNextSchedule(state1, 'EASY', review2);
      expect(res2.newStage).toBe(2);
      expect(res2.newIntervalDays).toBe(3);
      expect(res2.timingStatus).toBe('EARLY');
      expect(res2.latenessDays).toBe(1);

      // Anchored to review2 + 3 days = 2026-06-04T18:00:00Z
      const expectedNext = new Date('2026-06-04T18:00:00Z');
      expect(res2.newNextReviewDate.toISOString()).toBe(expectedNext.toISOString());
    });
  });

  describe('Cold Solve Independence from SRS Scheduler', () => {
    it('RevisionScheduler interface strictly does not take coldSolve and output is identical', () => {
      const reviewedAt = new Date('2026-07-01T12:00:00Z');
      const state: CurrentProblemScheduleState = {
        repetitionStage: 4,
        intervalDays: 14,
        nextReviewDate: reviewedAt,
        retentionLevel: 'Familiar',
      };

      const result = RevisionScheduler.calculateNextSchedule(state, 'EASY', reviewedAt);
      expect(result.newStage).toBe(5);
      expect(result.newIntervalDays).toBe(30);
      expect((result as Record<string, unknown>).coldSolve).toBeUndefined();
    });
  });
});
