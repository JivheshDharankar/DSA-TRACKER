import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { Problem } from '../src/models/Problem.model.js';
import { ProblemPattern } from '../src/models/ProblemPattern.model.js';
import { ProblemSequence } from '../src/models/ProblemSequence.model.js';
import { RevisionHistory } from '../src/models/RevisionHistory.model.js';
import { MasteryEvent } from '../src/models/MasteryEvent.model.js';
import { Pattern } from '../src/models/Pattern.model.js';
import { ReviewService } from '../src/services/review.service.js';
import { MasteryService } from '../src/services/mastery.service.js';
import { DashboardService } from '../src/services/dashboard.service.js';
import { PatternService } from '../src/services/pattern.service.js';

describe('Engineering Fix Pass #5: Database + Performance Audit Verification', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let userTokenCookie: string;
  let userId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Ensure all schema indexes are synced in MongoDB
    await Problem.syncIndexes();
    await ProblemPattern.syncIndexes();
    await ProblemSequence.syncIndexes();
    await RevisionHistory.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Problem.deleteMany({});
    await ProblemPattern.deleteMany({});
    await ProblemSequence.deleteMany({});
    await RevisionHistory.deleteMany({});
    await MasteryEvent.deleteMany({});
    await User.deleteMany({});
    await Pattern.deleteMany({});

    // Register primary test user
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Perf Tester',
      email: 'perf@example.com',
      password: 'Password123!',
    });
    userTokenCookie = regRes.headers['set-cookie']![0]!;
    userId = regRes.body.data.user.id;
  });

  describe('1. Schema Index Optimization & Redundancy Elimination', () => {
    it('Problem model has eliminated redundant single-field indexes and includes optimized compound indexes', async () => {
      const indexes = await Problem.collection.indexes();
      const indexKeys = indexes.map((idx) => Object.keys(idx.key));

      // 1. Standalone redundant single-field indexes must be ABSENT
      const hasStandaloneSection = indexes.some(
        (idx) => Object.keys(idx.key).length === 1 && idx.key.section === 1
      );
      const hasStandaloneNextReviewDate = indexes.some(
        (idx) => Object.keys(idx.key).length === 1 && idx.key.nextReviewDate === 1
      );
      const hasStandaloneMasteryStatus = indexes.some(
        (idx) => Object.keys(idx.key).length === 1 && idx.key.masteryStatus === 1
      );

      expect(hasStandaloneSection).toBe(false);
      expect(hasStandaloneNextReviewDate).toBe(false);
      expect(hasStandaloneMasteryStatus).toBe(false);

      // 2. High-traffic compound indexes must be PRESENT
      const hasCrossSectionReviewQueueIndex = indexes.some((idx) => {
        const k = idx.key;
        return k.userId === 1 && k.nextReviewDate === 1 && k.sNo === 1;
      });
      const hasCrossSectionSNoIndex = indexes.some((idx) => {
        const k = idx.key;
        return k.userId === 1 && k.sNo === 1 && Object.keys(k).length === 2;
      });

      expect(hasCrossSectionReviewQueueIndex).toBe(true);
      expect(hasCrossSectionSNoIndex).toBe(true);
    });

    it('ProblemPattern model has eliminated redundant userId index and includes { userId: 1, isPrimary: 1 }', async () => {
      const indexes = await ProblemPattern.collection.indexes();

      const hasStandaloneUserId = indexes.some(
        (idx) => Object.keys(idx.key).length === 1 && idx.key.userId === 1
      );
      const hasUserIdIsPrimary = indexes.some((idx) => {
        const k = idx.key;
        return k.userId === 1 && k.isPrimary === 1;
      });

      expect(hasStandaloneUserId).toBe(false);
      expect(hasUserIdIsPrimary).toBe(true);
    });

    it('ProblemSequence model has eliminated redundant standalone userId index', async () => {
      const indexes = await ProblemSequence.collection.indexes();

      const hasStandaloneUserId = indexes.some(
        (idx) => Object.keys(idx.key).length === 1 && idx.key.userId === 1
      );
      const hasCompoundUserSection = indexes.some((idx) => {
        const k = idx.key;
        return k.userId === 1 && k.section === 1;
      });

      expect(hasStandaloneUserId).toBe(false);
      expect(hasCompoundUserSection).toBe(true);
    });

    it('RevisionHistory model has eliminated redundant standalone userId index', async () => {
      const indexes = await RevisionHistory.collection.indexes();

      const hasStandaloneUserId = indexes.some(
        (idx) => Object.keys(idx.key).length === 1 && idx.key.userId === 1
      );
      const hasCompoundUserReviewedAt = indexes.some((idx) => {
        const k = idx.key;
        return k.userId === 1 && k.reviewedAt === -1;
      });

      expect(hasStandaloneUserId).toBe(false);
      expect(hasCompoundUserReviewedAt).toBe(true);
    });
  });

  describe('2. Query Execution Plans & Compound Index Utilization', () => {
    it('Problem.findDue uses the compound index { userId: 1, nextReviewDate: 1, sNo: 1 } for cross-section queries', async () => {
      const now = new Date();
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const explanation = (await Problem.find({
        userId: userObjectId,
        nextReviewDate: { $lte: now },
      })
        .sort({ nextReviewDate: 1, sNo: 1 })
        .explain('executionStats')) as any;

      const winningPlan = explanation.queryPlanner?.winningPlan;
      const jsonPlan = JSON.stringify(winningPlan);

      expect(jsonPlan).toContain('userId_1_nextReviewDate_1_sNo_1');
    });

    it('ProblemPattern.find({ userId, isPrimary: true }) uses the compound index { userId: 1, isPrimary: 1 }', async () => {
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const explanation = (await ProblemPattern.find({
        userId: userObjectId,
        isPrimary: true,
      }).explain('executionStats')) as any;

      const winningPlan = explanation.queryPlanner?.winningPlan;
      const jsonPlan = JSON.stringify(winningPlan);

      expect(jsonPlan).toContain('userId_1_isPrimary_1');
    });
  });

  describe('3. Review Lifecycle Query Reduction (Before vs. After submitReview)', () => {
    it('reduces Problem queries during EASY review submission by eliminating redundant findOne in post-review hook', async () => {
      // 1. Create a problem
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userTokenCookie)
        .send({
          section: 'PERSONAL',
          title: 'LRU Cache',
          difficulty: 'Medium',
          topic: 'Design',
          source: 'LeetCode',
          status: 'Solved',
        });
      const problemId = createRes.body.data.id || createRes.body.data._id || createRes.body.data.problem?.id;

      // 2. Seed 2 qualifying reviews so this 3rd review satisfies the 4 gates for LOCKED transition
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const probObjectId = new mongoose.Types.ObjectId(problemId);
      const pastDate1 = new Date(Date.now() - 14 * 86400000);
      const pastDate2 = new Date(Date.now() - 7 * 86400000);

      await RevisionHistory.create([
        {
          userId: userObjectId,
          problemId: probObjectId,
          reviewedAt: pastDate1,
          scheduledReviewAt: pastDate1,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: pastDate1,
          newNextReviewDate: pastDate2,
          coldSolve: true,
        },
        {
          userId: userObjectId,
          problemId: probObjectId,
          reviewedAt: pastDate2,
          scheduledReviewAt: pastDate2,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 1,
          newStage: 3, // stage >= 3 satisfied
          previousIntervalDays: 1,
          newIntervalDays: 7,
          previousRetention: 'Familiar',
          newRetention: 'Independent',
          previousNextReviewDate: pastDate2,
          newNextReviewDate: new Date(),
          coldSolve: true, // coldSolves >= 2 satisfied
        },
      ]);

      // Set problem to stage 3
      await Problem.updateOne({ _id: probObjectId }, { repetitionStage: 3, status: 'Solved' });

      // 3. Spy on Problem query execution
      const problemFindByIdSpy = vi.spyOn(Problem, 'findById');
      const problemFindOneSpy = vi.spyOn(Problem, 'findOne');
      const problemFindOneAndUpdateSpy = vi.spyOn(Problem, 'findOneAndUpdate');

      // 4. Submit EASY review via HTTP
      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userTokenCookie)
        .send({
          problemId,
          recallResult: 'EASY',
          coldSolve: true,
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.success).toBe(true);

      // 5. Verify Query Count:
      // Queries on Problem model during submitReview:
      // 1) Problem.findOne in ProblemRepository.findById (initial problem fetch)
      // 2) Problem.findOneAndUpdate in ProblemRepository.updateWithCondition (atomic SRS schedule update)
      // 3) Problem.findOne in LockedMasteryService.evaluateAndTransition (fetching fresh state for gate evaluation)
      // 4) Problem.findOneAndUpdate in LockedMasteryService.evaluateAndTransition (atomic UNLOCKED -> LOCKED transition)
      //
      // CRITICAL: Prior to Pass #5, handlePostReviewEvent executed an EXTRA Problem.findOne to check
      // `if (problem && problem.masteryStatus === 'UNLOCKED')` before calling evaluateAndTransition,
      // resulting in 3 Problem.findOne calls.
      // Now, evaluateAndTransition is called directly, resulting in exactly TWO Problem.findOne calls!
      expect(problemFindOneSpy).toHaveBeenCalledTimes(2);

      // Verify source of data: Problem.findOne was called once inside evaluateAndTransition
      expect(problemFindOneSpy).toHaveBeenCalledWith({
        _id: probObjectId,
        userId: userObjectId,
      });

      // Verify behavioral integrity:
      // Problem successfully transitioned to LOCKED
      const finalProblem = await Problem.findById(probObjectId);
      expect(finalProblem?.masteryStatus).toBe('LOCKED');
      expect(finalProblem?.lockVersion).toBe(1);

      // MasteryEvent was created
      const events = await MasteryEvent.find({ problemId: probObjectId });
      expect(events.length).toBe(1);
      expect(events[0]?.eventType).toBe('LOCKED');
      expect(events[0]?.reason).toBe('QUALIFICATION_MET');

      problemFindByIdSpy.mockRestore();
      problemFindOneSpy.mockRestore();
      problemFindOneAndUpdateSpy.mockRestore();
    });

    it('verifies review outcomes truth table, locking, and demotion behavior remain 100% intact', async () => {
      // 1. Create problem
      const p = await Problem.create({
        userId: new mongoose.Types.ObjectId(userId),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Reverse Linked List',
        topic: 'Linked List',
        difficulty: 'Easy',
        source: 'LeetCode',
        status: 'Solved',
        masteryStatus: 'LOCKED',
        lockedAt: new Date(),
        lockVersion: 1,
        repetitionStage: 4,
        intervalDays: 14,
        nextReviewDate: new Date(),
      });

      // 2. Test HINT outcome: Demotes LOCKED -> UNLOCKED
      const reviewService = new ReviewService();
      await reviewService.submitReview(userId, {
        problemId: p._id.toString(),
        recallResult: 'HINT',
      });

      // Wait brief moment for async post-review event handler
      await new Promise((resolve) => setTimeout(resolve, 50));

      const afterHintProblem = await Problem.findById(p._id);
      expect(afterHintProblem?.masteryStatus).toBe('UNLOCKED');
      expect(afterHintProblem?.repetitionStage).toBe(3); // drops 1 stage from 4 to 3 per SRS rules

      // Demotion event logged
      const hintEvents = await MasteryEvent.find({ problemId: p._id, eventType: 'UNLOCKED' });
      expect(hintEvents.length).toBe(1);
      expect(hintEvents[0]?.reason).toBe('SRS_FAILURE');

      // 3. Test FORGOT outcome: Also triggers demotion if locked
      await Problem.updateOne(
        { _id: p._id },
        { masteryStatus: 'LOCKED', repetitionStage: 5, lockVersion: 2 }
      );

      await reviewService.submitReview(userId, {
        problemId: p._id.toString(),
        recallResult: 'FORGOT',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const afterForgotProblem = await Problem.findById(p._id);
      expect(afterForgotProblem?.masteryStatus).toBe('UNLOCKED');
      expect(afterForgotProblem?.recoveryStage).toBe(0); // enters recovery at step 0

      const forgotEvents = await MasteryEvent.find({ problemId: p._id, eventType: 'UNLOCKED' });
      expect(forgotEvents.length).toBe(2);
    });
  });

  describe('4. Query-Equivalence Verification for Projections & Lean Modes', () => {
    it('auth.middleware projection provides all consumed fields (userId, name, email) without hydration overhead', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('Cookie', userTokenCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toEqual(
        expect.objectContaining({
          id: userId,
          name: 'Perf Tester',
          email: 'perf@example.com',
        })
      );
    });

    it('mastery.service.getUserMasteryOverview returns identical 4-gate breakdown using lean review query', async () => {
      // Seed a problem and reviews
      const p = await Problem.create({
        userId: new mongoose.Types.ObjectId(userId),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Merge Intervals',
        topic: 'Intervals',
        difficulty: 'Medium',
        source: 'LeetCode',
        status: 'Solved',
        nextReviewDate: new Date(),
      });

      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(userId),
        problemId: p._id,
        reviewedAt: new Date(),
        scheduledReviewAt: new Date(),
        recallResult: 'EASY',
        timingStatus: 'ON_TIME',
        latenessDays: 0,
        previousStage: 0,
        newStage: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        previousRetention: 'Learning',
        newRetention: 'Familiar',
        previousNextReviewDate: new Date(),
        newNextReviewDate: new Date(),
        coldSolve: true,
      });

      const masteryService = new MasteryService();
      const overview = await masteryService.getUserMasteryOverview(userId);

      expect(overview.length).toBe(1);
      const item = overview[0]!;
      expect(item.problem.id).toBe(p._id.toString());
      expect(item.problem.title).toBe('Merge Intervals');
      expect(item.gates.solved.passed).toBe(true);
      expect(item.gates.srsEvidence.successfulReviewsCount).toBe(1);
      expect(item.gates.coldRecall.qualifyingColdSolvesCount).toBe(1);
      expect(item.gates.recentSuccess.passed).toBe(true);
      expect(item.isEligible).toBe(false); // gate B requires 3 reviews
    });

    it('dashboard.service projections preserve exact frontend contract for recentActivity and primary patterns', async () => {
      const pattern = await Pattern.create({
        name: 'Two Pointers',
        slug: 'two-pointers',
        summary: 'Pointers technique',
        description: 'Detailed description not needed on dashboard cards',
        examples: ['Pair with target sum'],
        pitfalls: ['Out of bounds index'],
      });

      const p = await Problem.create({
        userId: new mongoose.Types.ObjectId(userId),
        section: 'COLLEGE',
        sNo: 1,
        title: 'Container With Most Water',
        topic: 'Two Pointers',
        difficulty: 'Medium',
        source: 'LeetCode',
        status: 'Solved',
        notes: 'Long notes up to 10KB that should NOT be over-fetched by recentActivity',
        nextReviewDate: new Date(),
      });

      await ProblemPattern.create({
        userId: new mongoose.Types.ObjectId(userId),
        problemId: p._id,
        patternId: pattern._id,
        isPrimary: true,
        confidenceLevel: 80,
      });

      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(userId),
        problemId: p._id,
        reviewedAt: new Date(),
        scheduledReviewAt: new Date(),
        recallResult: 'EASY',
        timingStatus: 'ON_TIME',
        latenessDays: 0,
        previousStage: 0,
        newStage: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        previousRetention: 'Learning',
        newRetention: 'Familiar',
        previousNextReviewDate: new Date(),
        newNextReviewDate: new Date(),
        coldSolve: true,
      });

      const dashboardService = new DashboardService();
      const dashboard = await dashboardService.getDashboardData(userId);

      expect(dashboard.recentActivity.length).toBe(1);
      const activity = dashboard.recentActivity[0]!;
      expect(activity.problemId).toBe(p._id.toString());
      expect(activity.problemTitle).toBe('Container With Most Water');
      expect(activity.problemSection).toBe('COLLEGE');
      expect(activity.problemDifficulty).toBe('Medium');
      expect(activity.primaryPatternName).toBe('Two Pointers');
      expect(activity.recallResult).toBe('EASY');
    });

    it('pattern.service projections preserve exact mastery calculation and breakdown metrics', async () => {
      const pattern = await Pattern.create({
        name: 'Sliding Window',
        slug: 'sliding-window',
        summary: 'Sliding window technique',
        description: 'Full description',
        examples: ['Longest substring'],
        pitfalls: ['Shrink condition'],
      });

      const p = await Problem.create({
        userId: new mongoose.Types.ObjectId(userId),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Longest Substring Without Repeating Characters',
        topic: 'Sliding Window',
        difficulty: 'Medium',
        source: 'LeetCode',
        status: 'Solved',
        nextReviewDate: new Date(),
      });

      await ProblemPattern.create({
        userId: new mongoose.Types.ObjectId(userId),
        problemId: p._id,
        patternId: pattern._id,
        isPrimary: true,
        confidenceLevel: 90,
      });

      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(userId),
        problemId: p._id,
        reviewedAt: new Date(),
        scheduledReviewAt: new Date(),
        recallResult: 'EASY',
        timingStatus: 'ON_TIME',
        latenessDays: 0,
        previousStage: 0,
        newStage: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        previousRetention: 'Learning',
        newRetention: 'Familiar',
        previousNextReviewDate: new Date(),
        newNextReviewDate: new Date(),
        coldSolve: true,
      });

      const patternService = new PatternService();
      const patterns = await patternService.getPatternsWithMastery(userId);

      expect(patterns.length).toBe(1);
      expect(patterns[0]?.name).toBe('Sliding Window');
      expect(patterns[0]?.mastery.problemCount).toBe(1);
      expect(patterns[0]?.mastery.solvedCount).toBe(1);
      expect(patterns[0]?.mastery.score).toBeGreaterThan(0);

      const detail = await patternService.getPatternDetail(userId, pattern._id.toString());
      expect(detail.pattern._id.toString()).toBe(pattern._id.toString());
      expect(detail.mastery.problemCount).toBe(1);
      expect(detail.mastery.solvedCount).toBe(1);
      expect(detail.associatedProblems.length).toBe(1);
      expect(detail.associatedProblems[0]?.problem.id).toBe(p._id.toString());
    });
  });
});
