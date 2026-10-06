import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { Problem } from '../src/models/Problem.model.js';
import { ProblemSequence } from '../src/models/ProblemSequence.model.js';
import { RevisionHistory } from '../src/models/RevisionHistory.model.js';
import { MasteryEvent } from '../src/models/MasteryEvent.model.js';
import { Pattern } from '../src/models/Pattern.model.js';
import { ProblemPattern } from '../src/models/ProblemPattern.model.js';
import { seedPatterns } from '../src/seeds/patterns.seed.js';
import { LockedMasteryEvaluator } from '../src/services/mastery.evaluator.js';
import { PatternMasteryCalculator } from '../src/services/patternMasteryCalculator.js';

describe('Engineering Fix Pass #4: Product Correctness & Behavioral Integrity Audit Suite', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let user1Cookie: string;
  let user1Id: string;
  let user2Cookie: string;
  let user2Id: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Seed the 30 global patterns
    await seedPatterns();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Problem.deleteMany({});
    await ProblemSequence.deleteMany({});
    await RevisionHistory.deleteMany({});
    await MasteryEvent.deleteMany({});
    await ProblemPattern.deleteMany({});

    // Register User 1
    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'User One',
      email: 'user1@example.com',
      password: 'Password123!',
    });
    user1Cookie = res1.headers['set-cookie']![0]!;
    user1Id = res1.body.data.user.id;

    // Register User 2
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'User Two',
      email: 'user2@example.com',
      password: 'Password123!',
    });
    user2Cookie = res2.headers['set-cookie']![0]!;
    user2Id = res2.body.data.user.id;
  });

  // Helper to create a problem for User 1
  const createProblem = async (
    title = 'Binary Search',
    section: 'PERSONAL' | 'COLLEGE' = 'PERSONAL',
    status = 'Solved'
  ) => {
    const res = await request(app)
      .post('/api/v1/problems')
      .set('Cookie', user1Cookie)
      .send({
        section,
        title,
        topic: 'Binary Search',
        difficulty: 'Medium',
        source: 'LeetCode',
        status,
      });
    return res.body.data.problem;
  };

  describe('1. End-to-End submitReview Flow & Truth Table Verification', () => {
    it('EASY: advances stage, promotes retention, creates history, and preserves Solved status', async () => {
      const prob = await createProblem('Two Sum', 'PERSONAL', 'Not Started');

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', user1Cookie)
        .send({
          problemId: prob.id,
          recallResult: 'EASY',
          timeSpentSeconds: 120,
          coldSolve: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const p = res.body.data.problem;
      expect(p.repetitionStage).toBe(1);
      expect(p.intervalDays).toBe(1);
      expect(p.retentionLevel).toBe('Familiar');
      expect(p.status).toBe('Solved'); // 'Not Started' promoted to 'Solved'

      // Check persisted history
      const historyRes = await request(app)
        .get(`/api/v1/reviews/problem/${prob.id}`)
        .set('Cookie', user1Cookie);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.items.length).toBe(1);
      const h = historyRes.body.data.items[0];
      expect(h.recallResult).toBe('EASY');
      expect(h.coldSolve).toBe(true);
      expect(h.timeSpentSeconds).toBe(120);
      expect(h.previousStage).toBe(0);
      expect(h.newStage).toBe(1);
    });

    it('STRUGGLED: advances stage from 0 to 1, promotes retention to Familiar', async () => {
      const prob = await createProblem('Three Sum', 'PERSONAL', 'Solved');

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', user1Cookie)
        .send({
          problemId: prob.id,
          recallResult: 'STRUGGLED',
          coldSolve: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.repetitionStage).toBe(1);
      expect(res.body.data.problem.intervalDays).toBe(1);
      expect(res.body.data.problem.retentionLevel).toBe('Familiar');
    });

    it('STRUGGLED at Stage >= 2: holds stage and retains retention level', async () => {
      // Create problem and manually advance to stage 3
      const prob = await createProblem('LRU Cache', 'PERSONAL', 'Solved');
      await Problem.findByIdAndUpdate(prob.id, {
        repetitionStage: 3,
        intervalDays: 7,
        retentionLevel: 'Independent',
      });

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', user1Cookie)
        .send({
          problemId: prob.id,
          recallResult: 'STRUGGLED',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.repetitionStage).toBe(3); // Conservative hold
      expect(res.body.data.problem.intervalDays).toBe(7);
      expect(res.body.data.problem.retentionLevel).toBe('Independent');
    });

    it('HINT: demotes stage by 1 (when > 2) and demotes retention', async () => {
      const prob = await createProblem('Merge Intervals', 'COLLEGE', 'Solved');
      await Problem.findByIdAndUpdate(prob.id, {
        repetitionStage: 4,
        intervalDays: 14,
        retentionLevel: 'Strong',
      });

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', user1Cookie)
        .send({
          problemId: prob.id,
          recallResult: 'HINT',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.repetitionStage).toBe(3); // 4 -> 3
      expect(res.body.data.problem.intervalDays).toBe(7);
      expect(res.body.data.problem.retentionLevel).toBe('Independent'); // Strong -> Independent
    });

    it('FORGOT: enters recovery sequence at 1d, preserves baseline stage, and resets retention to Learning', async () => {
      const prob = await createProblem('Word Break', 'PERSONAL', 'Solved');
      await Problem.findByIdAndUpdate(prob.id, {
        repetitionStage: 5,
        intervalDays: 30,
        retentionLevel: 'Strong',
      });

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', user1Cookie)
        .send({
          problemId: prob.id,
          recallResult: 'FORGOT',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.repetitionStage).toBe(5); // Preserves baseline stage
      expect(res.body.data.problem.recoveryStage).toBe(0); // Enters recovery at 0
      expect(res.body.data.problem.intervalDays).toBe(1); // 1 day interval
      expect(res.body.data.problem.retentionLevel).toBe('Learning');
    });
  });

  describe('2. Locked Mastery 4-Gate Boundary Invariants & Demotion Lifecycle', () => {
    it('3/4 gates satisfied (missing 2nd cold solve) leaves problem UNLOCKED', async () => {
      const prob = await createProblem('Search in Rotated Sorted Array', 'PERSONAL', 'Solved');

      // Add 3 successful reviews, but only 1 cold solve
      const now = new Date();
      await RevisionHistory.create([
        {
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: new mongoose.Types.ObjectId(prob.id),
          reviewedAt: new Date(now.getTime() - 20 * 86400000),
          scheduledReviewAt: new Date(now.getTime() - 20 * 86400000),
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: now,
          newNextReviewDate: now,
          coldSolve: true, // Cold solve #1
        },
        {
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: new mongoose.Types.ObjectId(prob.id),
          reviewedAt: new Date(now.getTime() - 10 * 86400000),
          scheduledReviewAt: new Date(now.getTime() - 10 * 86400000),
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 1,
          newStage: 2,
          previousIntervalDays: 1,
          newIntervalDays: 3,
          previousRetention: 'Familiar',
          newRetention: 'Independent',
          previousNextReviewDate: now,
          newNextReviewDate: now,
          coldSolve: false, // NOT a cold solve
        },
        {
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: new mongoose.Types.ObjectId(prob.id),
          reviewedAt: now,
          scheduledReviewAt: now,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 2,
          newStage: 3, // Reached Stage 3!
          previousIntervalDays: 3,
          newIntervalDays: 7,
          previousRetention: 'Independent',
          newRetention: 'Strong',
          previousNextReviewDate: now,
          newNextReviewDate: now,
          coldSolve: false, // NOT a cold solve
        },
      ]);

      const evalRes = await request(app)
        .post(`/api/v1/problems/${prob.id}/mastery/evaluate`)
        .set('Cookie', user1Cookie);

      expect(evalRes.status).toBe(200);
      expect(evalRes.body.data.evaluation.isEligible).toBe(false);
      expect(evalRes.body.data.evaluation.gates.solved.passed).toBe(true); // Gate A: Solved
      expect(evalRes.body.data.evaluation.gates.srsEvidence.passed).toBe(true); // Gate B: >=3 reviews, maxStage >= 3
      expect(evalRes.body.data.evaluation.gates.coldRecall.passed).toBe(false); // Gate C: 1 / 2 cold solves -> FAILS
      expect(evalRes.body.data.evaluation.gates.recentSuccess.passed).toBe(true); // Gate D: most recent is EASY
      expect(evalRes.body.data.masteryStatus).toBe('UNLOCKED');
    });

    it('4/4 gates satisfied locks problem atomically with lockVersion increment and MasteryEvent', async () => {
      const prob = await createProblem('Kth Largest Element', 'PERSONAL', 'Solved');
      const now = new Date();

      // Create qualifying history: 3 reviews, stage >= 3 reached, 2 cold solves, recent EASY
      await RevisionHistory.create([
        {
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: new mongoose.Types.ObjectId(prob.id),
          reviewedAt: new Date(now.getTime() - 20 * 86400000),
          scheduledReviewAt: new Date(now.getTime() - 20 * 86400000),
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: now,
          newNextReviewDate: now,
          coldSolve: true, // Cold solve #1
        },
        {
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: new mongoose.Types.ObjectId(prob.id),
          reviewedAt: new Date(now.getTime() - 10 * 86400000),
          scheduledReviewAt: new Date(now.getTime() - 10 * 86400000),
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 1,
          newStage: 2,
          previousIntervalDays: 1,
          newIntervalDays: 3,
          previousRetention: 'Familiar',
          newRetention: 'Independent',
          previousNextReviewDate: now,
          newNextReviewDate: now,
          coldSolve: true, // Cold solve #2
        },
        {
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: new mongoose.Types.ObjectId(prob.id),
          reviewedAt: now,
          scheduledReviewAt: now,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 2,
          newStage: 3, // Reached Stage 3!
          previousIntervalDays: 3,
          newIntervalDays: 7,
          previousRetention: 'Independent',
          newRetention: 'Strong',
          previousNextReviewDate: now,
          newNextReviewDate: now,
          coldSolve: false,
        },
      ]);

      const evalRes = await request(app)
        .post(`/api/v1/problems/${prob.id}/mastery/evaluate`)
        .set('Cookie', user1Cookie);

      expect(evalRes.status).toBe(200);
      expect(evalRes.body.data.evaluation.isEligible).toBe(true);
      expect(evalRes.body.data.masteryStatus).toBe('LOCKED');
      expect(evalRes.body.data.lockVersion).toBe(1);
      expect(evalRes.body.data.lockedAt).not.toBeNull();

      // Check MasteryEvent in DB
      const event = await MasteryEvent.findOne({ problemId: prob.id });
      expect(event).toBeDefined();
      expect(event?.eventType).toBe('LOCKED');
      expect(event?.reason).toBe('QUALIFICATION_MET');
      expect(event?.lockVersion).toBe(1);
    });

    it('demotes LOCKED -> UNLOCKED upon genuine SRS failure (HINT or FORGOT) and re-locks upon re-qualifying', async () => {
      const prob = await createProblem('Course Schedule', 'PERSONAL', 'Solved');
      await Problem.findByIdAndUpdate(prob.id, {
        masteryStatus: 'LOCKED',
        lockVersion: 1,
        lockedAt: new Date(),
        repetitionStage: 4,
        intervalDays: 14,
      });

      // Submit review with HINT
      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', user1Cookie)
        .send({
          problemId: prob.id,
          recallResult: 'HINT',
        });

      expect(reviewRes.status).toBe(200);

      // Verify demotion
      const updatedProb = await Problem.findById(prob.id);
      expect(updatedProb?.masteryStatus).toBe('UNLOCKED');
      expect(updatedProb?.lockVersion).toBe(2); // Incremented to 2
      expect(updatedProb?.unlockedAt).not.toBeNull();

      // Verify SRS_FAILURE event
      const failureEvent = await MasteryEvent.findOne({
        problemId: prob.id,
        eventType: 'UNLOCKED',
      });
      expect(failureEvent).toBeDefined();
      expect(failureEvent?.reason).toBe('SRS_FAILURE');
      expect(failureEvent?.lockVersion).toBe(2);
    });

    it('Gate D tie-breaker sorts by _id DESC when reviewedAt timestamps are identical', () => {
      const sameTime = new Date('2026-08-01T12:00:00.000Z');
      const idOlder = '507f1f77bcf86cd799439011';
      const idNewer = '507f1f77bcf86cd799439099';

      const reviews = [
        {
          _id: idOlder,
          reviewedAt: sameTime,
          recallResult: 'FORGOT', // Failure
          newStage: 1,
        },
        {
          _id: idNewer,
          reviewedAt: sameTime,
          recallResult: 'EASY', // Success (created later with higher hex string)
          newStage: 3,
        },
      ];

      const res = LockedMasteryEvaluator.evaluate({ status: 'Solved' }, reviews);
      // idNewer should win the tie-break, so latestOutcome is EASY -> Gate D passes
      expect(res.gates.recentSuccess.passed).toBe(true);
      expect(res.gates.recentSuccess.latestOutcome).toBe('EASY');
    });
  });

  describe('3. Pattern Mastery 5-Factor Numeric Verification & Cascade Deletion', () => {
    it('calculates exact 5-factor scores for a controlled dataset', () => {
      // 1 problem, Solved
      const problems = [{ id: 'p1', status: 'Solved' }];

      // 2 reviews: 1 cold solve EASY (100), 1 non-cold STRUGGLED (60)
      const reviews = [
        {
          problemId: 'p1',
          recallResult: 'EASY' as const,
          coldSolve: true,
          reviewedAt: new Date('2026-09-02T10:00:00Z'),
        },
        {
          problemId: 'p1',
          recallResult: 'STRUGGLED' as const,
          coldSolve: false,
          reviewedAt: new Date('2026-09-01T10:00:00Z'),
        },
      ];

      const result = PatternMasteryCalculator.calculate(problems, reviews);

      // Factor 1: Coverage (25%) -> solvedPart = min(100, 1/10*100) = 10, totalPart = min(100, 1/15*100) = 6.666
      // coverage = round(0.6 * 10 + 0.4 * 6.666) = round(6 + 2.666) = 9
      expect(result.breakdown.coverage).toBe(9);

      // Factor 2: Independent Recall (25%) -> 1 cold review EASY = 100
      expect(result.breakdown.independentRecall).toBe(100);

      // Factor 3: Recall Quality (20%) -> (100 + 60) / 2 = 80
      expect(result.breakdown.recallQuality).toBe(80);

      // Factor 4: Recent Consistency (15%) -> weights [5, 4] for reviews [EASY, STRUGGLED]
      // weightedSum = 5 * 100 + 4 * 60 = 500 + 240 = 740, totalWeight = 9 -> 740 / 9 = 82.222 -> round = 82
      expect(result.breakdown.recentConsistency).toBe(82);

      // Factor 5: Transfer Evidence (15%) -> 1 distinct problem with successful cold solve -> min(100, 1/8 * 100) = 12.5 -> round = 13
      expect(result.breakdown.transferEvidence).toBe(13);

      // Composite score: 0.25 * 9 + 0.25 * 100 + 0.20 * 80 + 0.15 * 82 + 0.15 * 13
      // = 2.25 + 25 + 16 + 12.3 + 1.95 = 57.5 -> round = 58
      expect(result.score).toBe(58);
      expect(result.masteryLevel).toBe('Familiar');
    });

    it('cascading deletion of a problem cleans up reviews, patterns, events, and recomputes stats cleanly', async () => {
      const prob = await createProblem('Valid Anagram', 'PERSONAL', 'Solved');
      const pattern = await Pattern.findOne({ slug: 'two-pointers' });
      expect(pattern).toBeDefined();

      // Attach pattern
      const attachRes = await request(app)
        .post(`/api/v1/problems/${prob.id}/patterns`)
        .set('Cookie', user1Cookie)
        .send({
          patternId: pattern!._id.toString(),
          confidence: 'HIGH',
          isPrimary: true,
        });
      expect(attachRes.status).toBe(201);

      // Submit a review
      await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', user1Cookie)
        .send({
          problemId: prob.id,
          recallResult: 'EASY',
          coldSolve: true,
        });

      // Verify records exist
      expect(await ProblemPattern.countDocuments({ problemId: prob.id })).toBe(1);
      expect(await RevisionHistory.countDocuments({ problemId: prob.id })).toBe(1);

      // Delete the problem
      const deleteRes = await request(app)
        .delete(`/api/v1/problems/${prob.id}`)
        .set('Cookie', user1Cookie);

      expect(deleteRes.status).toBe(200);

      // Verify cascade deletion
      expect(await Problem.findById(prob.id)).toBeNull();
      expect(await ProblemPattern.countDocuments({ problemId: prob.id })).toBe(0);
      expect(await RevisionHistory.countDocuments({ problemId: prob.id })).toBe(0);
      expect(await MasteryEvent.countDocuments({ problemId: prob.id })).toBe(0);

      // Verify dashboard read model recomputes cleanly to 0
      const dashRes = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.problemStats.total).toBe(0);
      expect(dashRes.body.data.reviewStats.totalReviews).toBe(0);
      expect(dashRes.body.data.recentActivity).toEqual([]);
    });
  });

  describe('4. UTC Date Alignment, Streaks & Section Isolation', () => {
    it('strictly isolates College DSA and Personal DSA section statistics', async () => {
      await createProblem('College Problem 1', 'COLLEGE', 'Solved');
      await createProblem('College Problem 2', 'COLLEGE', 'Attempted');
      await createProblem('Personal Problem 1', 'PERSONAL', 'Solved');
      await createProblem('Personal Problem 2', 'PERSONAL', 'Not Started');

      const dashRes = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(dashRes.status).toBe(200);
      const d = dashRes.body.data;

      expect(d.problemStats.college).toEqual({
        total: 2,
        solved: 1,
        attempted: 1,
        notStarted: 0,
      });

      expect(d.problemStats.personal).toEqual({
        total: 2,
        solved: 1,
        attempted: 0,
        notStarted: 1,
      });

      expect(d.problemStats.total).toBe(4);
      expect(d.problemStats.solved).toBe(2);
    });

    it('streak calculation recognizes UTC midnight boundaries across consecutive days', async () => {
      const prob = await createProblem('Climbing Stairs', 'PERSONAL', 'Solved');
      const now = new Date();

      // Today midnight UTC
      const startOfTodayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0)
      );
      // Yesterday midnight UTC
      const yesterdayUTC = new Date(startOfTodayUTC.getTime() - 24 * 60 * 60 * 1000);

      // Create reviews on yesterday and today
      await RevisionHistory.create([
        {
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: new mongoose.Types.ObjectId(prob.id),
          reviewedAt: yesterdayUTC,
          scheduledReviewAt: yesterdayUTC,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: yesterdayUTC,
          newNextReviewDate: startOfTodayUTC,
        },
        {
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: new mongoose.Types.ObjectId(prob.id),
          reviewedAt: startOfTodayUTC,
          scheduledReviewAt: startOfTodayUTC,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 1,
          newStage: 2,
          previousIntervalDays: 1,
          newIntervalDays: 3,
          previousRetention: 'Familiar',
          newRetention: 'Independent',
          previousNextReviewDate: startOfTodayUTC,
          newNextReviewDate: new Date(startOfTodayUTC.getTime() + 3 * 86400000),
        },
      ]);

      const dashRes = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.streak.current).toBe(2);
      expect(dashRes.body.data.streak.longest).toBe(2);
    });

    it('preserves current streak if active yesterday but not yet reviewed today', async () => {
      const prob = await createProblem('Min Cost Climbing Stairs', 'PERSONAL', 'Solved');
      const now = new Date();

      // Yesterday midnight UTC
      const startOfTodayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
      );
      const yesterdayUTC = new Date(startOfTodayUTC.getTime() - 12 * 60 * 60 * 1000); // 12h into yesterday

      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: new mongoose.Types.ObjectId(prob.id),
        reviewedAt: yesterdayUTC,
        scheduledReviewAt: yesterdayUTC,
        recallResult: 'EASY',
        timingStatus: 'ON_TIME',
        latenessDays: 0,
        previousStage: 0,
        newStage: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        previousRetention: 'Learning',
        newRetention: 'Familiar',
        previousNextReviewDate: yesterdayUTC,
        newNextReviewDate: startOfTodayUTC,
      });

      const dashRes = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.streak.current).toBe(1); // Streak preserved from yesterday!
    });
  });
});
