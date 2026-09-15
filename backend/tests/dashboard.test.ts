import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { Problem } from '../src/models/Problem.model.js';
import { Pattern } from '../src/models/Pattern.model.js';
import { ProblemPattern } from '../src/models/ProblemPattern.model.js';
import { RevisionHistory } from '../src/models/RevisionHistory.model.js';
import { seedPatterns } from '../src/seeds/patterns.seed.js';

describe('Dashboard Analytics & Activity Heatmap Comprehensive Tests', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();
  let user1Cookie: string;
  let user2Cookie: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Seed initial 30 patterns
    await seedPatterns();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Problem.deleteMany({});
    await ProblemPattern.deleteMany({});
    await RevisionHistory.deleteMany({});

    // Register User 1
    const res1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'user1@example.com',
        password: 'Password123!',
        name: 'User One',
      });
    user1Cookie = res1.headers['set-cookie']![0]!;
    user1Id = res1.body.data.user.id;

    // Register User 2
    const res2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'user2@example.com',
        password: 'Password123!',
        name: 'User Two',
      });
    user2Cookie = res2.headers['set-cookie']![0]!;
    user2Id = res2.body.data.user.id;
  });

  describe('1. Empty / Zero-State Dashboard', () => {
    it('returns a clean zero-state dashboard without NaN, null crashes, or negative values', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const d = res.body.data;
      expect(d.user.name).toBe('User One');
      expect(d.reviewQueue).toEqual({
        dueNow: 0,
        overdue: 0,
        dueToday: 0,
        upcoming: 0,
      });

      expect(d.problemStats.total).toBe(0);
      expect(d.problemStats.solved).toBe(0);
      expect(d.problemStats.attempted).toBe(0);
      expect(d.problemStats.notStarted).toBe(0);
      expect(d.problemStats.college).toEqual({
        total: 0,
        solved: 0,
        attempted: 0,
        notStarted: 0,
      });
      expect(d.problemStats.personal).toEqual({
        total: 0,
        solved: 0,
        attempted: 0,
        notStarted: 0,
      });

      expect(d.reviewStats.totalReviews).toBe(0);
      expect(d.reviewStats.easy).toBe(0);
      expect(d.reviewStats.struggled).toBe(0);
      expect(d.reviewStats.hint).toBe(0);
      expect(d.reviewStats.forgot).toBe(0);
      expect(d.reviewStats.successRate).toBe(0);
      expect(d.reviewStats.independentColdSolves).toBe(0);

      expect(d.timing.onTime).toBe(0);
      expect(d.timing.late).toBe(0);
      expect(d.timing.early).toBe(0);
      expect(d.timing.averageLatenessDays).toBe(0);

      expect(d.retention.learning).toBe(0);
      expect(d.retention.familiar).toBe(0);
      expect(d.retention.independent).toBe(0);
      expect(d.retention.strong).toBe(0);
      expect((d.retention as Record<string, unknown>).locked).toBeUndefined();

      expect(d.streak).toEqual({
        current: 0,
        longest: 0,
        lastActiveDate: null,
      });

      expect(d.activityHeatmap.length).toBe(365);
      expect(d.activityHeatmap.every((day: { count: number; level: number }) => day.count === 0 && day.level === 0)).toBe(true);

      expect(d.patternSummary.totalPatterns).toBe(30);
      expect(d.patternSummary.learning).toBe(30);
      expect(d.patternSummary.familiar).toBe(0);
      expect(d.patternSummary.independent).toBe(0);
      expect(d.patternSummary.strong).toBe(0);
      expect(d.recentActivity).toEqual([]);
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/dashboard');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Review Queue & Problem Statistics', () => {
    it('accurately categorizes review queues (overdue, due today, upcoming) and problem section splits', async () => {
      const now = new Date();
      const overdueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3, 12, 0, 0));
      const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      const upcomingDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 5, 12, 0, 0));

      // Overdue Problem (College, Solved)
      await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'COLLEGE',
        sNo: 1,
        title: 'Overdue College Problem',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'Lab 1',
        dateLearned: overdueDate,
        status: 'Solved',
        retentionLevel: 'Familiar',
        repetitionStage: 1,
        intervalDays: 1,
        nextReviewDate: overdueDate,
      });

      // Due Today Problem (Personal, Attempted)
      await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Due Today Problem',
        topic: 'Strings',
        difficulty: 'Medium',
        source: 'LeetCode',
        dateLearned: now,
        status: 'Attempted',
        retentionLevel: 'Learning',
        repetitionStage: 0,
        intervalDays: 0,
        nextReviewDate: todayDate,
      });

      // Upcoming Problem (Personal, Not Started)
      await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'PERSONAL',
        sNo: 2,
        title: 'Upcoming Problem',
        topic: 'Trees',
        difficulty: 'Hard',
        source: 'LeetCode',
        dateLearned: now,
        status: 'Not Started',
        retentionLevel: 'Strong',
        repetitionStage: 3,
        intervalDays: 7,
        nextReviewDate: upcomingDate,
      });

      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      const d = res.body.data;

      // Queue checks
      expect(d.reviewQueue.dueNow).toBe(2); // overdue (1) + dueToday (1)
      expect(d.reviewQueue.overdue).toBe(1);
      expect(d.reviewQueue.dueToday).toBe(1);
      expect(d.reviewQueue.upcoming).toBe(1);

      // Problem Stats checks
      expect(d.problemStats.total).toBe(3);
      expect(d.problemStats.solved).toBe(1);
      expect(d.problemStats.attempted).toBe(1);
      expect(d.problemStats.notStarted).toBe(1);

      expect(d.problemStats.college).toEqual({
        total: 1,
        solved: 1,
        attempted: 0,
        notStarted: 0,
      });
      expect(d.problemStats.personal).toEqual({
        total: 2,
        solved: 0,
        attempted: 1,
        notStarted: 1,
      });

      // Retention checks (Phase 6 strictly ignores Locked)
      expect(d.retention).toEqual({
        learning: 1,
        familiar: 1,
        independent: 0,
        strong: 1,
      });
    });
  });

  describe('3. Review Performance, Outcomes & Calendar-Day Timing', () => {
    it('correctly aggregates EASY, STRUGGLED, HINT, FORGOT, cold solves, and average lateness in integer days', async () => {
      const prob = await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Two Sum',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'LeetCode',
        dateLearned: new Date(),
        status: 'Solved',
        retentionLevel: 'Learning',
        repetitionStage: 0,
        intervalDays: 0,
        nextReviewDate: new Date(),
      });

      const now = new Date();

      // Review 1: EASY, ON_TIME, coldSolve: true, lateness: 0
      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: prob._id,
        reviewedAt: now,
        scheduledReviewAt: now,
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
        coldSolve: true,
      });

      // Review 2: STRUGGLED, LATE, coldSolve: false, lateness: 4
      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: prob._id,
        reviewedAt: now,
        scheduledReviewAt: now,
        recallResult: 'STRUGGLED',
        timingStatus: 'LATE',
        latenessDays: 4,
        previousStage: 1,
        newStage: 2,
        previousIntervalDays: 1,
        newIntervalDays: 3,
        previousRetention: 'Familiar',
        newRetention: 'Independent',
        previousNextReviewDate: now,
        newNextReviewDate: now,
        coldSolve: false,
      });

      // Review 3: HINT, LATE, coldSolve: false, lateness: 2
      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: prob._id,
        reviewedAt: now,
        scheduledReviewAt: now,
        recallResult: 'HINT',
        timingStatus: 'LATE',
        latenessDays: 2,
        previousStage: 2,
        newStage: 2,
        previousIntervalDays: 3,
        newIntervalDays: 3,
        previousRetention: 'Independent',
        newRetention: 'Independent',
        previousNextReviewDate: now,
        newNextReviewDate: now,
        coldSolve: false,
      });

      // Review 4: FORGOT, EARLY, coldSolve: false, lateness: 1
      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: prob._id,
        reviewedAt: now,
        scheduledReviewAt: now,
        recallResult: 'FORGOT',
        timingStatus: 'EARLY',
        latenessDays: 1,
        previousStage: 2,
        newStage: 0,
        previousIntervalDays: 3,
        newIntervalDays: 0,
        previousRetention: 'Independent',
        newRetention: 'Learning',
        previousNextReviewDate: now,
        newNextReviewDate: now,
        coldSolve: false,
      });

      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      const d = res.body.data;

      expect(d.reviewStats.totalReviews).toBe(4);
      expect(d.reviewStats.easy).toBe(1);
      expect(d.reviewStats.struggled).toBe(1);
      expect(d.reviewStats.hint).toBe(1);
      expect(d.reviewStats.forgot).toBe(1);
      expect(d.reviewStats.independentColdSolves).toBe(1);
      expect(d.reviewStats.successRate).toBe(50); // (1 EASY + 1 STRUGGLED) / 4 = 50%

      expect(d.timing.onTime).toBe(1);
      expect(d.timing.late).toBe(2);
      expect(d.timing.early).toBe(1);
      // Average lateness among the 2 late reviews: (4 + 2) / 2 = 3 days
      expect(d.timing.averageLatenessDays).toBe(3);
    });
  });

  describe('4. Activity Heatmap & Intensity Buckets', () => {
    it('places multiple reviews into appropriate intensity levels (0, 1, 2, 3, 4)', async () => {
      const prob = await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Heatmap Testing Problem',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'LeetCode',
        dateLearned: new Date(),
        status: 'Solved',
        retentionLevel: 'Learning',
        repetitionStage: 0,
        intervalDays: 0,
        nextReviewDate: new Date(),
      });

      const now = new Date();
      // Date 1: 1 review -> level 1
      const date1 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 10, 10, 0, 0));
      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: prob._id,
        reviewedAt: date1,
        scheduledReviewAt: date1,
        recallResult: 'EASY',
        timingStatus: 'ON_TIME',
        latenessDays: 0,
        previousStage: 0,
        newStage: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        previousRetention: 'Learning',
        newRetention: 'Familiar',
        previousNextReviewDate: date1,
        newNextReviewDate: date1,
        coldSolve: true,
      });

      // Date 2: 3 reviews -> level 2
      const date2 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 8, 10, 0, 0));
      for (let i = 0; i < 3; i++) {
        await RevisionHistory.create({
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: prob._id,
          reviewedAt: date2,
          scheduledReviewAt: date2,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: date2,
          newNextReviewDate: date2,
          coldSolve: true,
        });
      }

      // Date 3: 5 reviews -> level 3
      const date3 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 5, 10, 0, 0));
      for (let i = 0; i < 5; i++) {
        await RevisionHistory.create({
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: prob._id,
          reviewedAt: date3,
          scheduledReviewAt: date3,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: date3,
          newNextReviewDate: date3,
          coldSolve: true,
        });
      }

      // Date 4: 8 reviews -> level 4
      const date4 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2, 10, 0, 0));
      for (let i = 0; i < 8; i++) {
        await RevisionHistory.create({
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: prob._id,
          reviewedAt: date4,
          scheduledReviewAt: date4,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: date4,
          newNextReviewDate: date4,
          coldSolve: true,
        });
      }

      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      const heatmap = res.body.data.activityHeatmap;
      expect(heatmap.length).toBe(365);

      const d1Str = date1.toISOString().split('T')[0];
      const d2Str = date2.toISOString().split('T')[0];
      const d3Str = date3.toISOString().split('T')[0];
      const d4Str = date4.toISOString().split('T')[0];

      const item1 = heatmap.find((h: { date: string }) => h.date === d1Str);
      expect(item1.count).toBe(1);
      expect(item1.level).toBe(1);

      const item2 = heatmap.find((h: { date: string }) => h.date === d2Str);
      expect(item2.count).toBe(3);
      expect(item2.level).toBe(2);

      const item3 = heatmap.find((h: { date: string }) => h.date === d3Str);
      expect(item3.count).toBe(5);
      expect(item3.level).toBe(3);

      const item4 = heatmap.find((h: { date: string }) => h.date === d4Str);
      expect(item4.count).toBe(8);
      expect(item4.level).toBe(4);
    });
  });

  describe('5. Practice Streaks (Current, Longest, Preserved Yesterday, Broken)', () => {
    it('preserves streak when active yesterday but not yet today, and accurately calculates historical longest streak', async () => {
      const prob = await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Streak Testing Problem',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'LeetCode',
        dateLearned: new Date(),
        status: 'Solved',
        retentionLevel: 'Learning',
        repetitionStage: 0,
        intervalDays: 0,
        nextReviewDate: new Date(),
      });

      const now = new Date();

      // Historical 5-day streak: 30, 29, 28, 27, 26 days ago
      for (let offset = 26; offset <= 30; offset++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, 10, 0, 0));
        await RevisionHistory.create({
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: prob._id,
          reviewedAt: d,
          scheduledReviewAt: d,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: d,
          newNextReviewDate: d,
          coldSolve: true,
        });
      }

      // Current streak: 2 days active (2 days ago and yesterday, but not today)
      for (let offset = 1; offset <= 2; offset++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, 10, 0, 0));
        await RevisionHistory.create({
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: prob._id,
          reviewedAt: d,
          scheduledReviewAt: d,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: d,
          newNextReviewDate: d,
          coldSolve: true,
        });
      }

      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      const streak = res.body.data.streak;

      // Active yesterday -> current streak preserved at 2 days
      expect(streak.current).toBe(2);
      // Longest historical streak is 5 days
      expect(streak.longest).toBe(5);
    });

    it('resets current streak to 0 when no review was logged today or yesterday', async () => {
      const prob = await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Broken Streak Problem',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'LeetCode',
        dateLearned: new Date(),
        status: 'Solved',
        retentionLevel: 'Learning',
        repetitionStage: 0,
        intervalDays: 0,
        nextReviewDate: new Date(),
      });

      const now = new Date();
      // Only active 3 days ago and 4 days ago
      for (let offset = 3; offset <= 4; offset++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, 10, 0, 0));
        await RevisionHistory.create({
          userId: new mongoose.Types.ObjectId(user1Id),
          problemId: prob._id,
          reviewedAt: d,
          scheduledReviewAt: d,
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: d,
          newNextReviewDate: d,
          coldSolve: true,
        });
      }

      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      const streak = res.body.data.streak;
      expect(streak.current).toBe(0);
      expect(streak.longest).toBe(2);
    });
  });

  describe('6. Pattern Mastery Integration & Sorting Hierarchy', () => {
    it('reuses Phase 5 calculator and provides strongest and needs-practice lists', async () => {
      const tp = await Pattern.findOne({ slug: 'two-pointers' });
      const sw = await Pattern.findOne({ slug: 'sliding-window' });

      expect(tp).toBeDefined();
      expect(sw).toBeDefined();

      const prob = await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Two Pointers Practice Problem',
        topic: 'Arrays',
        difficulty: 'Medium',
        source: 'LeetCode',
        dateLearned: new Date(),
        status: 'Solved',
        retentionLevel: 'Learning',
        repetitionStage: 0,
        intervalDays: 0,
        nextReviewDate: new Date(),
      });

      await ProblemPattern.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: prob._id,
        patternId: tp!._id,
        confidence: 'HIGH',
        isPrimary: true,
      });

      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: prob._id,
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

      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      const d = res.body.data;

      expect(d.patternSummary.totalPatterns).toBe(30);
      expect(d.patternSummary.strongestPatterns[0].slug).toBe('two-pointers');
      expect(d.patternSummary.strongestPatterns[0].score).toBeGreaterThan(0);

      // Needs Practice patterns must be Learning patterns (score 0), sorted by lower score first
      expect(d.patternSummary.needsPracticePatterns.length).toBe(3);
      expect(d.patternSummary.needsPracticePatterns[0].masteryLevel).toBe('Learning');
      expect(d.patternSummary.needsPracticePatterns[0].score).toBe(0);
    });
  });

  describe('7. Cross-User Privacy & Security Guarantees', () => {
    it('strictly isolates User 1 and User 2 data and ignores client userId spoofing', async () => {
      // User 1 creates problem and review
      const prob1 = await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Secret User 1 Problem',
        topic: 'Arrays',
        difficulty: 'Hard',
        source: 'LeetCode',
        dateLearned: new Date(),
        status: 'Solved',
        retentionLevel: 'Strong',
        repetitionStage: 4,
        intervalDays: 15,
        nextReviewDate: new Date(),
      });

      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: prob1._id,
        reviewedAt: new Date(),
        scheduledReviewAt: new Date(),
        recallResult: 'EASY',
        timingStatus: 'ON_TIME',
        latenessDays: 0,
        previousStage: 3,
        newStage: 4,
        previousIntervalDays: 7,
        newIntervalDays: 15,
        previousRetention: 'Independent',
        newRetention: 'Strong',
        previousNextReviewDate: new Date(),
        newNextReviewDate: new Date(),
        coldSolve: true,
      });

      // User 2 requests their dashboard
      const res2 = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user2Cookie);

      expect(res2.status).toBe(200);
      const d2 = res2.body.data;

      expect(d2.user.name).toBe('User Two');
      expect(d2.problemStats.total).toBe(0);
      expect(d2.problemStats.solved).toBe(0);
      expect(d2.reviewStats.totalReviews).toBe(0);
      expect(d2.streak.current).toBe(0);
      expect(d2.recentActivity).toEqual([]);

      // Attempt spoofing with query parameter
      const spoofRes = await request(app)
        .get(`/api/v1/dashboard?userId=${user1Id}`)
        .set('Cookie', user2Cookie);

      expect(spoofRes.status).toBe(200);
      expect(spoofRes.body.data.user.name).toBe('User Two');
      expect(spoofRes.body.data.problemStats.total).toBe(0);
    });
  });

  describe('8. Deleted Problem Handling & Stability (No null.toString() crash)', () => {
    it('returns 200, includes valid problems, and omits deleted problems from recentActivity without null.toString() error', async () => {
      // 1. User has a valid problem + review
      const validProblem = await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'PERSONAL',
        sNo: 1,
        title: 'Active Living Problem',
        topic: 'Arrays',
        difficulty: 'Medium',
        source: 'LeetCode',
        dateLearned: new Date(),
        status: 'Solved',
        retentionLevel: 'Learning',
        repetitionStage: 1,
        intervalDays: 1,
        nextReviewDate: new Date(),
      });

      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: validProblem._id,
        reviewedAt: new Date(Date.now() - 5000),
        scheduledReviewAt: new Date(Date.now() - 5000),
        recallResult: 'EASY',
        timingStatus: 'ON_TIME',
        latenessDays: 0,
        previousStage: 0,
        newStage: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        previousRetention: 'Learning',
        newRetention: 'Learning',
        previousNextReviewDate: new Date(Date.now() - 5000),
        newNextReviewDate: new Date(),
        coldSolve: true,
      });

      // 2. Another reviewed problem is created and then deleted
      const doomedProblem = await Problem.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        section: 'COLLEGE',
        sNo: 2,
        title: 'Doomed To Deletion Problem',
        topic: 'Trees',
        difficulty: 'Easy',
        source: 'College',
        dateLearned: new Date(),
        status: 'Solved',
        retentionLevel: 'Learning',
        repetitionStage: 1,
        intervalDays: 1,
        nextReviewDate: new Date(),
      });

      await RevisionHistory.create({
        userId: new mongoose.Types.ObjectId(user1Id),
        problemId: doomedProblem._id,
        reviewedAt: new Date(Date.now() - 1000),
        scheduledReviewAt: new Date(Date.now() - 1000),
        recallResult: 'STRUGGLED',
        timingStatus: 'ON_TIME',
        latenessDays: 0,
        previousStage: 0,
        newStage: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        previousRetention: 'Learning',
        newRetention: 'Learning',
        previousNextReviewDate: new Date(Date.now() - 1000),
        newNextReviewDate: new Date(),
        coldSolve: false,
      });

      // Delete the doomed problem
      await Problem.findByIdAndDelete(doomedProblem._id);

      // 3. GET /api/v1/dashboard returns HTTP 200 without crashing on null.toString()
      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const recentActivity = res.body.data.recentActivity;

      // 4. recentActivity contains the valid problem
      expect(recentActivity.length).toBe(1);
      expect(recentActivity[0].problemId).toBe(validProblem._id.toString());
      expect(recentActivity[0].problemTitle).toBe('Active Living Problem');
      expect(recentActivity[0].problemTitle).not.toBe('Unknown Problem');

      // 5. Deleted problem is omitted from recentActivity
      const doomedInActivity = recentActivity.find(
        (item: any) => item.problemId === doomedProblem._id.toString()
      );
      expect(doomedInActivity).toBeUndefined();

      // 6. Underlying RevisionHistory remains intact in DB (append-only)
      const allHistories = await RevisionHistory.find({ userId: user1Id });
      expect(allHistories.length).toBe(2);
    });
  });
});
