import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { Problem } from '../src/models/Problem.model.js';
import { ProblemSequence } from '../src/models/ProblemSequence.model.js';
import { RevisionHistory } from '../src/models/RevisionHistory.model.js';
import {
  RevisionScheduler,
  CurrentProblemScheduleState,
} from '../src/services/revisionScheduler.js';

/**
 * SRS calendar-day eligibility regression suite
 * =============================================
 * Scheduling must be based on **UTC calendar days**, not elapsed 24-hour periods:
 * a review completed at 23:59 with a 1-day interval becomes due at 00:00 the next
 * calendar day — never at 23:59 the following day.
 *
 * Clocks are frozen with `vi.setSystemTime` for the API-level cases, so nothing here
 * waits in real time. Only the `Date` constructor is faked (`toFake: ['Date']`) so the
 * Mongo driver's socket timers keep running normally.
 */

/** Registration instant. Every frozen clock in this file moves forward from here, so the
 *  session cookie (iat = BASE, exp = BASE + 7d) stays valid for the whole suite. */
const BASE = '2026-07-01T00:00:00.000Z';

/** Move the (already installed) fake clock to an exact instant. */
const freezeAt = (iso: string): void => {
  vi.setSystemTime(new Date(iso));
};

const stateAt = (
  repetitionStage: number,
  intervalDays: number,
  nextReviewDate: string
): CurrentProblemScheduleState => ({
  repetitionStage,
  intervalDays,
  nextReviewDate: new Date(nextReviewDate),
  retentionLevel: 'Strong',
});

describe('SRS calendar-day eligibility', () => {
  describe('1. Scheduling anchors to the start of the target UTC calendar day (pure)', () => {
    it('a review completed at 23:59 becomes due at 00:00 the next calendar day', () => {
      const result = RevisionScheduler.calculateNextSchedule(
        stateAt(0, 0, '2026-10-11T23:59:00.000Z'),
        'EASY',
        new Date('2026-10-11T23:59:59.999Z')
      );

      // Interval/outcome rules are untouched: stage 0 -> 1, 1 day.
      expect(result.newStage).toBe(1);
      expect(result.newIntervalDays).toBe(1);
      // The scheduled day is the next calendar day, at its first instant.
      expect(result.newNextReviewDate.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    });

    it('a 23:59:00.000 completion behaves identically to 23:59:59.999', () => {
      const early = RevisionScheduler.calculateNextSchedule(
        stateAt(0, 0, '2026-10-11T23:59:00.000Z'),
        'EASY',
        new Date('2026-10-11T23:59:00.000Z')
      );
      const late = RevisionScheduler.calculateNextSchedule(
        stateAt(0, 0, '2026-10-11T23:59:00.000Z'),
        'EASY',
        new Date('2026-10-11T23:59:59.999Z')
      );

      expect(early.newNextReviewDate.toISOString()).toBe('2026-10-12T00:00:00.000Z');
      expect(late.newNextReviewDate.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    });

    it('a completion shortly after midnight schedules the correct next calendar day', () => {
      const justAfter = RevisionScheduler.calculateNextSchedule(
        stateAt(0, 0, '2026-10-12T00:05:00.000Z'),
        'EASY',
        new Date('2026-10-12T00:05:00.000Z')
      );
      const exactlyMidnight = RevisionScheduler.calculateNextSchedule(
        stateAt(0, 0, '2026-10-12T00:00:00.000Z'),
        'EASY',
        new Date('2026-10-12T00:00:00.000Z')
      );

      expect(justAfter.newNextReviewDate.toISOString()).toBe('2026-10-13T00:00:00.000Z');
      expect(exactlyMidnight.newNextReviewDate.toISOString()).toBe('2026-10-13T00:00:00.000Z');
    });

    it('month boundary: Oct 31 + 1 day lands on Nov 1 at midnight', () => {
      const result = RevisionScheduler.calculateNextSchedule(
        stateAt(0, 0, '2026-10-31T23:59:59.000Z'),
        'EASY',
        new Date('2026-10-31T23:59:59.000Z')
      );

      expect(result.newNextReviewDate.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    });

    it('year boundary: Dec 31 + 1 day lands on Jan 1 of the next year at midnight', () => {
      const result = RevisionScheduler.calculateNextSchedule(
        stateAt(0, 0, '2026-12-31T23:59:59.000Z'),
        'EASY',
        new Date('2026-12-31T23:59:59.000Z')
      );

      expect(result.newNextReviewDate.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });

    it('30-day interval crosses a 31-day month and anchors to midnight', () => {
      const result = RevisionScheduler.calculateNextSchedule(
        stateAt(4, 14, '2026-10-11T23:59:59.000Z'),
        'EASY',
        new Date('2026-10-11T23:59:59.000Z')
      );

      expect(result.newStage).toBe(5);
      expect(result.newIntervalDays).toBe(30);
      expect(result.newNextReviewDate.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    });

    it('120-day interval crosses month and year boundaries and anchors to midnight', () => {
      const result = RevisionScheduler.calculateNextSchedule(
        stateAt(6, 60, '2026-10-11T23:59:59.000Z'),
        'EASY',
        new Date('2026-10-11T23:59:59.000Z')
      );

      expect(result.newStage).toBe(7);
      expect(result.newIntervalDays).toBe(120);
      expect(result.newNextReviewDate.toISOString()).toBe('2027-02-08T00:00:00.000Z');
    });

    it('240-day interval anchors to midnight', () => {
      const result = RevisionScheduler.calculateNextSchedule(
        stateAt(7, 120, '2026-10-11T23:59:59.000Z'),
        'EASY',
        new Date('2026-10-11T23:59:59.000Z')
      );

      expect(result.newStage).toBe(8);
      expect(result.newIntervalDays).toBe(240);
      expect(result.newNextReviewDate.toISOString()).toBe('2027-06-08T00:00:00.000Z');
    });

    it('365-day interval anchors to midnight, not to the completion clock time', () => {
      const result = RevisionScheduler.calculateNextSchedule(
        stateAt(8, 240, '2026-10-11T23:59:59.000Z'),
        'EASY',
        new Date('2026-10-11T23:59:59.000Z')
      );

      expect(result.newStage).toBe(9);
      expect(result.newIntervalDays).toBe(365);
      expect(result.newNextReviewDate.toISOString()).toBe('2027-10-11T00:00:00.000Z');
    });

    it('recovery sequence (FORGOT -> 1d) also anchors to midnight', () => {
      const result = RevisionScheduler.calculateNextSchedule(
        stateAt(5, 30, '2026-10-11T23:59:59.000Z'),
        'FORGOT',
        new Date('2026-10-11T23:59:59.000Z')
      );

      expect(result.newRecoveryStage).toBe(0);
      expect(result.newIntervalDays).toBe(1);
      expect(result.newNextReviewDate.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    });

    it('the UTC midnight boundary is independent of the host timezone', () => {
      const originalTz = process.env.TZ;
      const reviewedAt = new Date('2026-10-11T23:59:59.999Z');

      try {
        for (const tz of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
          process.env.TZ = tz;
          const result = RevisionScheduler.calculateNextSchedule(
            stateAt(0, 0, '2026-10-11T23:59:00.000Z'),
            'EASY',
            reviewedAt
          );
          expect(result.newNextReviewDate.toISOString()).toBe('2026-10-12T00:00:00.000Z');
          expect(result.newNextReviewDate.getTime() % 86400000).toBe(0);
        }
      } finally {
        if (originalTz === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = originalTz;
        }
      }
    });
  });

  describe('2. Queue, dashboard and persistence under a frozen clock (API)', () => {
    let mongoServer: MongoMemoryServer;
    const app = createApp();
    let cookie: string;
    let userSeq = 0;

    beforeAll(async () => {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
    });

    afterAll(async () => {
      await mongoose.disconnect();
      if (mongoServer) await mongoServer.stop();
    });

    beforeEach(async () => {
      await Problem.deleteMany({});
      await ProblemSequence.deleteMany({});
      await RevisionHistory.deleteMany({});
      await User.deleteMany({});

      vi.useFakeTimers({ toFake: ['Date'], now: new Date(BASE) });
      userSeq += 1;
      const res = await request(app).post('/api/v1/auth/register').send({
        name: `Clock Tester ${userSeq}`,
        email: `clock-${userSeq}@example.com`,
        password: 'Password123!',
      });
      expect(res.status).toBe(201);
      cookie = res.headers['set-cookie']![0]!;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const createProblem = async (title: string): Promise<string> => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', cookie)
        .send({
          section: 'PERSONAL',
          title,
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'LeetCode',
        });
      expect(res.status).toBe(201);
      return res.body.data.problem.id as string;
    };

    const dueResponse = async () => {
      const res = await request(app).get('/api/v1/reviews/due').set('Cookie', cookie);
      expect(res.status).toBe(200);
      return res;
    };

    const dueTitles = async (): Promise<string[]> => {
      const res = await dueResponse();
      return res.body.data.items.map((p: { title: string }) => p.title);
    };

    const dueCount = async (): Promise<number> => {
      const res = await dueResponse();
      return res.body.data.pagination.total as number;
    };

    const dashboardQueue = async () => {
      const res = await request(app).get('/api/v1/dashboard').set('Cookie', cookie);
      expect(res.status).toBe(200);
      return res.body.data.reviewQueue as {
        dueNow: number;
        overdue: number;
        dueToday: number;
        upcoming: number;
      };
    };

    it('a problem is eligible for the whole of its due calendar day, and not before it', async () => {
      const problemId = await createProblem('Calendar Day Problem');
      await Problem.findByIdAndUpdate(problemId, {
        nextReviewDate: new Date('2026-07-02T00:00:00.000Z'),
        repetitionStage: 1,
        intervalDays: 1,
      });

      // The instant before the due day began: not eligible.
      freezeAt('2026-07-01T23:59:59.999Z');
      expect(await dueTitles()).not.toContain('Calendar Day Problem');

      // Every instant of the due calendar day: eligible (00:00 → 23:59:59.999).
      for (const instant of [
        '2026-07-02T00:00:00.000Z',
        '2026-07-02T00:00:00.001Z',
        '2026-07-02T09:17:43.000Z',
        '2026-07-02T12:00:00.000Z',
        '2026-07-02T23:59:59.999Z',
      ]) {
        freezeAt(instant);
        expect(await dueTitles()).toContain('Calendar Day Problem');
      }

      // The following calendar day: still eligible (now overdue).
      freezeAt('2026-07-03T00:00:00.000Z');
      expect(await dueTitles()).toContain('Calendar Day Problem');
    });

    it('legacy rows that still carry a time-of-day are eligible on their calendar due date', async () => {
      const problemId = await createProblem('Legacy Timestamp Problem');
      // Pre-normalisation shape: the stored value keeps a 18:30 clock time.
      await Problem.findByIdAndUpdate(problemId, {
        nextReviewDate: new Date('2026-07-02T18:30:00.000Z'),
      });

      // Start of the due calendar day — long before the stored 18:30 clock time.
      freezeAt('2026-07-02T00:00:00.000Z');
      expect(await dueTitles()).toContain('Legacy Timestamp Problem');

      // Midday of the due calendar day.
      freezeAt('2026-07-02T12:00:00.000Z');
      expect(await dueTitles()).toContain('Legacy Timestamp Problem');

      // The previous calendar day: must remain ineligible.
      freezeAt('2026-07-01T12:00:00.000Z');
      expect(await dueTitles()).not.toContain('Legacy Timestamp Problem');
    });

    it('the queue and the dashboard cannot disagree, and overdue starts the next calendar day', async () => {
      const problemId = await createProblem('Overdue Transition Problem');
      await Problem.findByIdAndUpdate(problemId, {
        nextReviewDate: new Date('2026-07-02T00:00:00.000Z'),
        repetitionStage: 1,
        intervalDays: 1,
      });

      // On the due calendar day: due (today), not yet overdue.
      freezeAt('2026-07-02T12:00:00.000Z');
      let queue = await dashboardQueue();
      expect(queue.dueToday).toBe(1);
      expect(queue.overdue).toBe(0);
      expect(queue.upcoming).toBe(0);
      expect(queue.dueNow).toBe(1);
      expect(queue.dueNow).toBe(queue.overdue + queue.dueToday);
      expect(await dueCount()).toBe(queue.dueNow);

      // The following calendar day: overdue, still due, counts still agree.
      freezeAt('2026-07-03T00:00:00.000Z');
      queue = await dashboardQueue();
      expect(queue.overdue).toBe(1);
      expect(queue.dueToday).toBe(0);
      expect(queue.dueNow).toBe(1);
      expect(queue.dueNow).toBe(queue.overdue + queue.dueToday);
      expect(await dueCount()).toBe(queue.dueNow);
    });

    it('completing a review at 23:59 persists a midnight-aligned next revision', async () => {
      freezeAt('2026-07-01T23:59:59.999Z');
      const problemId = await createProblem('Late Night Problem');
      expect(await dueTitles()).toContain('Late Night Problem');

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', cookie)
        .send({ problemId, recallResult: 'EASY' });

      expect(res.status).toBe(200);
      const { problem, history, transition } = res.body.data;

      // The completion instant is recorded verbatim, and only the schedule is normalised.
      expect(problem.lastReviewedAt).toBe('2026-07-01T23:59:59.999Z');
      expect(history.reviewedAt).toBe('2026-07-01T23:59:59.999Z');
      expect(problem.repetitionStage).toBe(1);
      expect(problem.intervalDays).toBe(1);
      expect(problem.nextReviewDate).toBe('2026-07-02T00:00:00.000Z');
      expect(history.newNextReviewDate).toBe('2026-07-02T00:00:00.000Z');
      expect(transition.nextReviewDate).toBe('2026-07-02T00:00:00.000Z');
      expect(transition.timingStatus).toBe('ON_TIME');

      // The next revision is due from the start of the next calendar day, not at 23:59.
      freezeAt('2026-07-02T00:00:00.000Z');
      expect(await dueTitles()).toContain('Late Night Problem');

      freezeAt('2026-07-02T12:00:00.000Z');
      expect(await dueTitles()).toContain('Late Night Problem');

      // ... and it is not due during the remainder of the completion day.
      freezeAt('2026-07-01T23:59:59.999Z');
      expect(await dueTitles()).not.toContain('Late Night Problem');
    });

    it('revision history and due counts stay correct after a calendar-day review', async () => {
      freezeAt('2026-07-01T23:59:59.999Z');
      const problemId = await createProblem('History Integrity Problem');
      expect(await dueCount()).toBe(1);

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', cookie)
        .send({ problemId, recallResult: 'EASY' });
      expect(res.status).toBe(200);

      // Reviewed at 23:59 for a 00:00 due date: it leaves the queue until the next due day.
      expect(await dueCount()).toBe(0);

      const problemHistory = await request(app)
        .get(`/api/v1/reviews/problem/${problemId}`)
        .set('Cookie', cookie);
      expect(problemHistory.status).toBe(200);
      expect(problemHistory.body.data.items).toHaveLength(1);
      expect(problemHistory.body.data.pagination.total).toBe(1);
      expect(problemHistory.body.data.items[0].recallResult).toBe('EASY');
      expect(problemHistory.body.data.items[0].newNextReviewDate).toBe('2026-07-02T00:00:00.000Z');

      const userHistory = await request(app).get('/api/v1/reviews/history').set('Cookie', cookie);
      expect(userHistory.status).toBe(200);
      expect(userHistory.body.data.items).toHaveLength(1);
      expect(userHistory.body.data.pagination.total).toBe(1);

      // The next due day puts it back in the queue exactly once.
      freezeAt('2026-07-02T00:00:00.000Z');
      expect(await dueCount()).toBe(1);
    });
  });
});
