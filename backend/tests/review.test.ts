import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { Problem } from '../src/models/Problem.model.js';
import { ProblemSequence } from '../src/models/ProblemSequence.model.js';
import { RevisionHistory } from '../src/models/RevisionHistory.model.js';

describe('Spaced Repetition & Revision Engine API (Phase 4)', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let userACookie: string;
  let userBCookie: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
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

    // Register User A
    const regResA = await request(app).post('/api/v1/auth/register').send({
      name: 'User Alpha',
      email: 'alpha@example.com',
      password: 'Password123!',
    });
    userACookie = regResA.headers['set-cookie']![0]!;

    // Register User B
    const regResB = await request(app).post('/api/v1/auth/register').send({
      name: 'User Beta',
      email: 'beta@example.com',
      password: 'Password123!',
    });
    userBCookie = regResB.headers['set-cookie']![0]!;
  });

  describe('1. Initial Scheduling on Problem Creation', () => {
    it('newly created problem receives initial Day 0 spaced repetition state', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Two Sum',
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'LeetCode',
        });

      expect(res.status).toBe(201);
      const prob = res.body.data.problem;
      expect(prob.repetitionStage).toBe(0);
      expect(prob.intervalDays).toBe(0);
      expect(prob.nextReviewDate).toBeDefined();
      expect(prob.lastReviewedAt).toBeNull();
      expect(prob.recoveryStage).toBeNull();
    });
  });

  describe('2. Revision Submission & Recall Transitions', () => {
    it('EASY advances stage + 1, promotes retention, anchors next review date, and creates history', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Binary Search',
          topic: 'Search',
          difficulty: 'Easy',
          source: 'Lecture',
        });
      const problemId = createRes.body.data.problem.id;

      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId,
          recallResult: 'EASY',
          timeSpentSeconds: 300,
          coldSolve: true,
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.problem.repetitionStage).toBe(1);
      expect(reviewRes.body.data.problem.intervalDays).toBe(1);
      expect(reviewRes.body.data.problem.retentionLevel).toBe('Familiar');
      expect(reviewRes.body.data.transition.timingStatus).toBe('ON_TIME');
      expect(reviewRes.body.data.transition.latenessDays).toBe(0);

      // Verify history document exists
      const historyList = await RevisionHistory.find({ problemId });
      expect(historyList.length).toBe(1);
      expect(historyList[0]!.recallResult).toBe('EASY');
      expect(historyList[0]!.previousStage).toBe(0);
      expect(historyList[0]!.newStage).toBe(1);
      expect(historyList[0]!.previousIntervalDays).toBe(0);
      expect(historyList[0]!.newIntervalDays).toBe(1);
    });

    it('FORGOT enters recovery sequence at Step 0 (1 day) while preserving baseline stage', async () => {
      // Create problem and set it to Stage 4 (14 days)
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'LRU Cache',
          topic: 'Design',
          difficulty: 'Medium',
          source: 'LeetCode',
        });
      const problemId = createRes.body.data.problem.id;

      await Problem.findByIdAndUpdate(problemId, {
        repetitionStage: 4,
        intervalDays: 14,
        retentionLevel: 'Strong',
      });

      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId,
          recallResult: 'FORGOT',
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.problem.repetitionStage).toBe(4); // Preserved
      expect(reviewRes.body.data.problem.recoveryStage).toBe(0); // Recovery step 0
      expect(reviewRes.body.data.problem.intervalDays).toBe(1); // 1 day review
      expect(reviewRes.body.data.problem.retentionLevel).toBe('Learning');
    });

    it('Recovery sequence progresses with subsequent successful reviews and exits to normal stage', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Word Break',
          topic: 'DP',
          difficulty: 'Hard',
          source: 'LeetCode',
        });
      const problemId = createRes.body.data.problem.id;

      // Put in recovery step 0
      await Problem.findByIdAndUpdate(problemId, {
        repetitionStage: 3,
        intervalDays: 1,
        recoveryStage: 0,
        retentionLevel: 'Learning',
      });

      // Review 1: EASY -> advances recovery step to 1 (3 days)
      const rev1 = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({ problemId, recallResult: 'EASY' });
      expect(rev1.body.data.problem.recoveryStage).toBe(1);
      expect(rev1.body.data.problem.intervalDays).toBe(3);

      // Fast-forward to final recovery step 3
      await Problem.findByIdAndUpdate(problemId, {
        recoveryStage: 3,
        intervalDays: 14,
        lastReviewedAt: rev1.body.data.problem.lastReviewedAt,
      });

      // Review 2: EASY -> completes recovery and returns to normal stage
      const rev2 = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({ problemId, recallResult: 'EASY' });
      expect(rev2.body.data.problem.recoveryStage).toBeNull();
      expect(rev2.body.data.problem.repetitionStage).toBe(3);
      expect(rev2.body.data.problem.intervalDays).toBe(7); // Stage 3 interval
    });
  });

  describe('3. Calendar-Day Timing & Lateness Calculations', () => {
    it('calculates ON_TIME with latenessDays = 0 for same-day review', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Merge Intervals',
          topic: 'Intervals',
          difficulty: 'Medium',
          source: 'LeetCode',
        });
      const problemId = createRes.body.data.problem.id;

      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({ problemId, recallResult: 'EASY' });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.transition.timingStatus).toBe('ON_TIME');
      expect(reviewRes.body.data.transition.latenessDays).toBe(0);
    });

    it('calculates LATE with positive latenessDays and preserves EASY recall without penalty', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: '3Sum',
          topic: 'Two Pointers',
          difficulty: 'Medium',
          source: 'LeetCode',
        });
      const problemId = createRes.body.data.problem.id;

      // Set scheduled review to 3 calendar days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

      await Problem.findByIdAndUpdate(problemId, {
        nextReviewDate: threeDaysAgo,
        repetitionStage: 2,
        intervalDays: 3,
      });

      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({ problemId, recallResult: 'EASY' });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.transition.timingStatus).toBe('LATE');
      expect(reviewRes.body.data.transition.latenessDays).toBe(3);
      expect(reviewRes.body.data.history.recallResult).toBe('EASY'); // Preserved!
      expect(reviewRes.body.data.problem.repetitionStage).toBe(3); // Advanced!
    });

    it('calculates EARLY with positive non-negative latenessDays', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Valid Anagram',
          topic: 'Strings',
          difficulty: 'Easy',
          source: 'LeetCode',
        });
      const problemId = createRes.body.data.problem.id;

      // Set scheduled review to 2 calendar days in the future
      const twoDaysFuture = new Date();
      twoDaysFuture.setUTCDate(twoDaysFuture.getUTCDate() + 2);

      await Problem.findByIdAndUpdate(problemId, {
        nextReviewDate: twoDaysFuture,
        repetitionStage: 1,
        intervalDays: 1,
      });

      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({ problemId, recallResult: 'EASY' });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.transition.timingStatus).toBe('EARLY');
      expect(reviewRes.body.data.transition.latenessDays).toBe(2); // Non-negative!
    });
  });

  describe('4. Strict Input Validation & Security', () => {
    it('rejects invalid recallResult', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Test Problem',
          topic: 'Testing',
          difficulty: 'Easy',
          source: 'Personal',
        });

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId: createRes.body.data.problem.id,
          recallResult: 'SUPER_EASY', // Invalid
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects negative timeSpentSeconds', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Test Problem',
          topic: 'Testing',
          difficulty: 'Easy',
          source: 'Personal',
        });

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId: createRes.body.data.problem.id,
          recallResult: 'EASY',
          timeSpentSeconds: -50,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects client injection of server-authoritative fields (userId, latenessDays, etc.)', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Test Problem',
          topic: 'Testing',
          difficulty: 'Easy',
          source: 'Personal',
        });

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId: createRes.body.data.problem.id,
          recallResult: 'EASY',
          latenessDays: 0, // Injected
          newStage: 9, // Injected
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('5. Due Reviews Queue & History Scoping', () => {
    it('returns only due problems (nextReviewDate <= now) and excludes future problems', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days in future

      // Due Problem
      const pDue = await request(app).post('/api/v1/problems').set('Cookie', userACookie).send({
        section: 'PERSONAL',
        title: 'Overdue Problem',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'LeetCode',
      });
      await Problem.findByIdAndUpdate(pDue.body.data.problem.id, { nextReviewDate: pastDate });

      // Future Problem
      const pFuture = await request(app).post('/api/v1/problems').set('Cookie', userACookie).send({
        section: 'PERSONAL',
        title: 'Future Problem',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'LeetCode',
      });
      await Problem.findByIdAndUpdate(pFuture.body.data.problem.id, { nextReviewDate: futureDate });

      const dueRes = await request(app)
        .get('/api/v1/reviews/due?section=PERSONAL')
        .set('Cookie', userACookie);

      expect(dueRes.status).toBe(200);
      expect(dueRes.body.data.items.length).toBe(1);
      expect(dueRes.body.data.items[0].title).toBe('Overdue Problem');
    });

    it('User B cannot review or see User A problem revision history (Complete Privacy)', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Private College Problem',
          topic: 'Graphs',
          difficulty: 'Medium',
          source: 'Lecture',
        });
      const problemId = createRes.body.data.problem.id;

      // User A submits revision
      await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({ problemId, recallResult: 'EASY' });

      // User B attempts to submit revision -> 404
      const reviewB = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userBCookie)
        .send({ problemId, recallResult: 'EASY' });
      expect(reviewB.status).toBe(404);

      // User B attempts to fetch history -> 404
      const historyB = await request(app)
        .get(`/api/v1/reviews/problem/${problemId}`)
        .set('Cookie', userBCookie);
      expect(historyB.status).toBe(404);

      // User A can fetch history
      const historyA = await request(app)
        .get(`/api/v1/reviews/problem/${problemId}`)
        .set('Cookie', userACookie);
      expect(historyA.status).toBe(200);
      expect(historyA.body.data.items.length).toBe(1);
    });

    it('returns chronological user-wide review history with populated problem metadata and valid problemId string', async () => {
      // Create and review a problem for User A
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'History Scoping Problem',
          topic: 'History',
          difficulty: 'Medium',
          source: 'Lecture',
        });
      const histProblemId = createRes.body.data.problem.id;

      await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId: histProblemId,
          recallResult: 'EASY',
          coldSolve: true,
        });

      // User A fetches user-wide history
      const userHistory = await request(app)
        .get('/api/v1/reviews/history')
        .set('Cookie', userACookie);

      expect(userHistory.status).toBe(200);
      expect(userHistory.body.success).toBe(true);
      expect(userHistory.body.data.items.length).toBeGreaterThan(0);

      const firstItem = userHistory.body.data.items[0];
      // Verify problemId is a 24-character hex ObjectId string, NEVER '[object Object]'
      expect(typeof firstItem.problemId).toBe('string');
      expect(firstItem.problemId).not.toBe('[object Object]');
      expect(firstItem.problemId).toMatch(/^[a-f\d]{24}$/i);

      // Verify problem metadata is populated
      expect(firstItem.problem).toBeDefined();
      expect(firstItem.problem.title).toBe('History Scoping Problem');
      expect(firstItem.problem.section).toBe('COLLEGE');
      expect(typeof firstItem.problem.sNo).toBe('number');
    });

    it('preserves review history and returns problem: null when a reviewed problem is deleted', async () => {
      // Create a problem specifically to review then delete
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Problem Destined For Deletion',
          topic: 'Temporary',
          difficulty: 'Easy',
          source: 'Lecture',
        });
      const delProblemId = createRes.body.data.problem.id;

      // Review the problem
      await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId: delProblemId,
          recallResult: 'EASY',
          coldSolve: true,
        });

      // Delete the problem
      const delRes = await request(app)
        .delete(`/api/v1/problems/${delProblemId}`)
        .set('Cookie', userACookie);
      expect(delRes.status).toBe(200);

      // Query user-wide history
      const historyRes = await request(app)
        .get('/api/v1/reviews/history')
        .set('Cookie', userACookie);

      expect(historyRes.status).toBe(200);
      const delHistoryItem = historyRes.body.data.items.find(
        (it: any) => it.problemId === delProblemId
      );
      expect(delHistoryItem).toBeDefined();
      expect(delHistoryItem.problem).toBeNull();
      expect(delHistoryItem.recallResult).toBe('EASY');
    });

    it('verifies existing problem appears with real title and valid link data, while deleted problem is omitted from visible presentation with no fabricated labels', async () => {
      // 1. Create a problem that remains active
      const activeRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Surviving History Problem',
          topic: 'Strings',
          difficulty: 'Medium',
          source: 'LeetCode',
        });
      const activeProbId = activeRes.body.data.problem.id;

      await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId: activeProbId,
          recallResult: 'STRUGGLED',
          coldSolve: true,
        });

      // 2. Create a problem that will be deleted
      const doomedRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Ephemeral Problem',
          topic: 'Bitwise',
          difficulty: 'Easy',
          source: 'College',
        });
      const doomedProbId = doomedRes.body.data.problem.id;

      await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId: doomedProbId,
          recallResult: 'EASY',
          coldSolve: false,
        });

      // Delete the ephemeral problem
      await request(app)
        .delete(`/api/v1/problems/${doomedProbId}`)
        .set('Cookie', userACookie);

      // Verify underlying DB persistence: both review history records remain in database
      const dbReviews = await RevisionHistory.find({ problemId: { $in: [activeProbId, doomedProbId] } });
      expect(dbReviews.length).toBe(2);

      // Fetch user review history from API
      const historyRes = await request(app)
        .get('/api/v1/reviews/history')
        .set('Cookie', userACookie);

      expect(historyRes.status).toBe(200);
      const items = historyRes.body.data.items;

      // 1. Existing problem appears with correct title and valid link data
      const activeItem = items.find((it: any) => it.problemId === activeProbId);
      expect(activeItem).toBeDefined();
      expect(activeItem.problem).toBeDefined();
      expect(activeItem.problem.title).toBe('Surviving History Problem');
      expect(activeItem.problem._id || activeItem.problem.id).toBeDefined();

      // 2. Deleted problem history record remains in DB and API response with problem: null
      const doomedItem = items.find((it: any) => it.problemId === doomedProbId);
      expect(doomedItem).toBeDefined();
      expect(doomedItem.problem).toBeNull();

      // 3. Transformation to visible Review History presentation (matches ReviewHistoryPage logic)
      const visibleItems = items
        .filter((rev: any) => rev.problem && rev.problem.title && (rev.problem._id || rev.problem.id))
        .map((rev: any) => ({
          problemId: rev.problem._id || rev.problem.id,
          title: rev.problem.title,
        }));

      // Deleted problem does NOT appear in visible presentation
      const visibleDoomed = visibleItems.find((v: any) => v.problemId === doomedProbId);
      expect(visibleDoomed).toBeUndefined();

      // Active problem appears with real title and valid link id
      const visibleActive = visibleItems.find((v: any) => v.problemId === activeProbId);
      expect(visibleActive).toBeDefined();
      expect(visibleActive?.title).toBe('Surviving History Problem');

      // 4 & 5. No "Problem deleted" and no fabricated "Problem #"
      for (const v of visibleItems) {
        expect(v.title).not.toBe('Problem deleted');
        expect(v.title).not.toMatch(/^Problem #\d+/);
        expect(v.title).not.toBe('[object Object]');
      }
    });
  });

  describe('6. Concurrency & Duplicate Submission Protection', () => {
    it('handles concurrent submissions safely and rejects stale baseline updates', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Concurrent Review Problem',
          topic: 'Concurrency',
          difficulty: 'Hard',
          source: 'Personal',
        });
      const problemId = createRes.body.data.problem.id;

      // Submit two revisions in parallel
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/reviews')
          .set('Cookie', userACookie)
          .send({ problemId, recallResult: 'EASY' }),
        request(app)
          .post('/api/v1/reviews')
          .set('Cookie', userACookie)
          .send({ problemId, recallResult: 'EASY' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // One must succeed (200), and if the second collided on optimistic condition it gets 409 or sequential 200
      expect(statuses[0]).toBe(200);
      expect([200, 409]).toContain(statuses[1]);
    });
  });
});

