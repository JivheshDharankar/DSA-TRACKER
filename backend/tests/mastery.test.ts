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
import { LockedMasteryEvaluator } from '../src/services/mastery.evaluator.js';
import { masteryService } from '../src/services/mastery.service.js';

describe('Locked Mastery & Multi-Gate Completion System (4-Gate Design)', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;

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
    await MasteryEvent.deleteMany({});
    await ProblemPattern.deleteMany({});
    await Pattern.deleteMany({});
    await User.deleteMany({});

    // Register User A
    const regResA = await request(app).post('/api/v1/auth/register').send({
      name: 'User Alpha',
      email: 'alpha@example.com',
      password: 'Password123!',
    });
    userACookie = regResA.headers['set-cookie']![0]!;
    userAId = regResA.body.data.user.id;

    // Register User B
    const regResB = await request(app).post('/api/v1/auth/register').send({
      name: 'User Beta',
      email: 'beta@example.com',
      password: 'Password123!',
    });
    userBCookie = regResB.headers['set-cookie']![0]!;
    userBId = regResB.body.data.user.id;
  });

  // Helper to create a problem for User A
  const createProblem = async (title = 'Two Sum', status = 'Solved') => {
    const res = await request(app)
      .post('/api/v1/problems')
      .set('Cookie', userACookie)
      .send({
        section: 'PERSONAL',
        title,
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'LeetCode',
        status,
      });
    return res.body.data.problem;
  };

  describe('1. Pure Deterministic Evaluator (Gates A–D)', () => {
    it('Gate A: Fails if problem status is Not Started or Attempted, passes if Solved', () => {
      const resNotStarted = LockedMasteryEvaluator.evaluate({ status: 'Not Started' }, []);
      expect(resNotStarted.gates.solved.passed).toBe(false);

      const resAttempted = LockedMasteryEvaluator.evaluate({ status: 'Attempted' }, []);
      expect(resAttempted.gates.solved.passed).toBe(false);

      const resSolved = LockedMasteryEvaluator.evaluate({ status: 'Solved' }, []);
      expect(resSolved.gates.solved.passed).toBe(true);
    });

    it('Gate B: Evaluates spaced review evidence (requires >= 3 successes AND stage >= 3 reached)', () => {
      const id1 = new mongoose.Types.ObjectId();
      const id2 = new mongoose.Types.ObjectId();
      const id3 = new mongoose.Types.ObjectId();

      // Case 1: 0 reviews -> fails
      const res0 = LockedMasteryEvaluator.evaluate({ status: 'Solved' }, []);
      expect(res0.gates.srsEvidence.passed).toBe(false);
      expect(res0.gates.srsEvidence.successfulReviewsCount).toBe(0);

      // Case 2: 2 successful reviews with stage >= 3 -> fails (needs 3 reviews)
      const res2 = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: id1, reviewedAt: new Date(1000), recallResult: 'EASY', newStage: 3 },
          { _id: id2, reviewedAt: new Date(2000), recallResult: 'EASY', newStage: 4 },
        ]
      );
      expect(res2.gates.srsEvidence.passed).toBe(false);
      expect(res2.gates.srsEvidence.successfulReviewsCount).toBe(2);
      expect(res2.gates.srsEvidence.hasStageThreeMilestone).toBe(true);

      // Case 3: 3 successful reviews but max stage is 2 (< 3) -> fails stage milestone
      const res3NoStage3 = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: id1, reviewedAt: new Date(1000), recallResult: 'EASY', newStage: 1 },
          { _id: id2, reviewedAt: new Date(2000), recallResult: 'STRUGGLED', newStage: 2 },
          { _id: id3, reviewedAt: new Date(3000), recallResult: 'EASY', newStage: 2 },
        ]
      );
      expect(res3NoStage3.gates.srsEvidence.passed).toBe(false);
      expect(res3NoStage3.gates.srsEvidence.successfulReviewsCount).toBe(3);
      expect(res3NoStage3.gates.srsEvidence.hasStageThreeMilestone).toBe(false);

      // Case 4: 3 successful reviews with at least one stage >= 3 -> passes Gate B
      const res3WithStage3 = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: id1, reviewedAt: new Date(1000), recallResult: 'EASY', newStage: 1 },
          { _id: id2, reviewedAt: new Date(2000), recallResult: 'EASY', newStage: 2 },
          { _id: id3, reviewedAt: new Date(3000), recallResult: 'EASY', newStage: 3 },
        ]
      );
      expect(res3WithStage3.gates.srsEvidence.passed).toBe(true);
      expect(res3WithStage3.gates.srsEvidence.successfulReviewsCount).toBe(3);
      expect(res3WithStage3.gates.srsEvidence.hasStageThreeMilestone).toBe(true);
    });

    it('Gate C: Evaluates cold solve requirement (requires >= 2 successful cold solves)', () => {
      const id1 = new mongoose.Types.ObjectId();
      const id2 = new mongoose.Types.ObjectId();

      // 0 cold solves
      const res0 = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [{ _id: id1, reviewedAt: new Date(1000), recallResult: 'EASY', newStage: 1, coldSolve: false }]
      );
      expect(res0.gates.coldRecall.passed).toBe(false);
      expect(res0.gates.coldRecall.qualifyingColdSolvesCount).toBe(0);

      // 1 successful cold solve
      const res1 = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [{ _id: id1, reviewedAt: new Date(1000), recallResult: 'EASY', newStage: 1, coldSolve: true }]
      );
      expect(res1.gates.coldRecall.passed).toBe(false);
      expect(res1.gates.coldRecall.qualifyingColdSolvesCount).toBe(1);

      // 2 cold solves, but 1 was a failure (HINT) -> only 1 qualifies -> fails
      const res2WithFail = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: id1, reviewedAt: new Date(1000), recallResult: 'EASY', newStage: 1, coldSolve: true },
          { _id: id2, reviewedAt: new Date(2000), recallResult: 'HINT', newStage: 0, coldSolve: true },
        ]
      );
      expect(res2WithFail.gates.coldRecall.passed).toBe(false);
      expect(res2WithFail.gates.coldRecall.qualifyingColdSolvesCount).toBe(1);

      // 2 successful cold solves (EASY / STRUGGLED) -> passes Gate C
      const res2Success = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: id1, reviewedAt: new Date(1000), recallResult: 'EASY', newStage: 1, coldSolve: true },
          { _id: id2, reviewedAt: new Date(2000), recallResult: 'STRUGGLED', newStage: 2, coldSolve: true },
        ]
      );
      expect(res2Success.gates.coldRecall.passed).toBe(true);
      expect(res2Success.gates.coldRecall.qualifyingColdSolvesCount).toBe(2);
    });

    it('Gate D: Evaluates recent RevisionHistory review outcome (most recent review must be EASY or STRUGGLED)', () => {
      const id1 = new mongoose.Types.ObjectId();
      const id2 = new mongoose.Types.ObjectId();

      // 0 reviews -> fails Gate D
      const res0 = LockedMasteryEvaluator.evaluate({ status: 'Solved' }, []);
      expect(res0.gates.recentSuccess.passed).toBe(false);
      expect(res0.gates.recentSuccess.latestOutcome).toBeNull();
      expect(res0.gates.recentSuccess.latestTimestamp).toBeNull();

      // Latest review is EASY -> passes
      const resEasy = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: id1, reviewedAt: new Date(1000), recallResult: 'FORGOT', newStage: 0 },
          { _id: id2, reviewedAt: new Date(2000), recallResult: 'EASY', newStage: 1 },
        ]
      );
      expect(resEasy.gates.recentSuccess.passed).toBe(true);
      expect(resEasy.gates.recentSuccess.latestOutcome).toBe('EASY');

      // Latest review is STRUGGLED -> passes
      const resStruggled = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: id1, reviewedAt: new Date(2000), recallResult: 'STRUGGLED', newStage: 1 },
        ]
      );
      expect(resStruggled.gates.recentSuccess.passed).toBe(true);
      expect(resStruggled.gates.recentSuccess.latestOutcome).toBe('STRUGGLED');

      // Latest review is FORGOT -> fails
      const resForgot = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: id1, reviewedAt: new Date(1000), recallResult: 'EASY', newStage: 3 },
          { _id: id2, reviewedAt: new Date(3000), recallResult: 'FORGOT', newStage: 0 },
        ]
      );
      expect(resForgot.gates.recentSuccess.passed).toBe(false);
      expect(resForgot.gates.recentSuccess.latestOutcome).toBe('FORGOT');

      // Latest review is HINT -> fails
      const resHint = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: id1, reviewedAt: new Date(1000), recallResult: 'EASY', newStage: 3 },
          { _id: id2, reviewedAt: new Date(3000), recallResult: 'HINT', newStage: 1 },
        ]
      );
      expect(resHint.gates.recentSuccess.passed).toBe(false);
      expect(resHint.gates.recentSuccess.latestOutcome).toBe('HINT');

      // Deterministic tie-breaking on same timestamp using _id string DESC
      const revIdLower = new mongoose.Types.ObjectId('65f000000000000000000001');
      const revIdHigher = new mongoose.Types.ObjectId('65f000000000000000000002');
      const sameTime = new Date(5000);

      const resTie = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: revIdLower, reviewedAt: sameTime, recallResult: 'EASY', newStage: 2 },
          { _id: revIdHigher, reviewedAt: sameTime, recallResult: 'FORGOT', newStage: 0 },
        ]
      );
      // revIdHigher wins the tie, which was FORGOT -> gate fails
      expect(resTie.gates.recentSuccess.passed).toBe(false);
      expect(resTie.gates.recentSuccess.latestOutcome).toBe('FORGOT');
    });

    it('Evaluates overall isEligible when all 4 gates pass', () => {
      const id1 = new mongoose.Types.ObjectId();
      const id2 = new mongoose.Types.ObjectId();
      const id3 = new mongoose.Types.ObjectId();

      const allPass = LockedMasteryEvaluator.evaluate(
        { status: 'Solved' },
        [
          { _id: id1, reviewedAt: new Date(1000), recallResult: 'EASY', newStage: 1, coldSolve: true },
          { _id: id2, reviewedAt: new Date(2000), recallResult: 'EASY', newStage: 2, coldSolve: true },
          { _id: id3, reviewedAt: new Date(3000), recallResult: 'EASY', newStage: 3, coldSolve: false },
        ]
      );

      expect(allPass.gates.solved.passed).toBe(true);
      expect(allPass.gates.srsEvidence.passed).toBe(true);
      expect(allPass.gates.coldRecall.passed).toBe(true);
      expect(allPass.gates.recentSuccess.passed).toBe(true);
      expect(allPass.isEligible).toBe(true);
    });
  });

  describe('2. Mastery Inspection API (GET /api/v1/problems/:id/mastery)', () => {
    it('returns mastery state and 4-gate qualification details for a problem', async () => {
      const prob = await createProblem('Climbing Stairs', 'Solved');

      const res = await request(app)
        .get(`/api/v1/problems/${prob.id}/mastery`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.problemId).toBe(prob.id);
      expect(res.body.data.masteryStatus).toBe('UNLOCKED');
      expect(res.body.data.isEligible).toBe(false);
      expect(res.body.data.lockVersion).toBe(0);
      expect(res.body.data.lockedAt).toBeNull();
      expect(res.body.data.gates.solved.passed).toBe(true);
      expect(res.body.data.gates.srsEvidence.passed).toBe(false);
      expect(res.body.data.gates.coldRecall.passed).toBe(false);
      expect(res.body.data.gates.recentSuccess.passed).toBe(false);
    });

    it('rejects cross-user access with 404', async () => {
      const prob = await createProblem('Private Problem');

      const res = await request(app)
        .get(`/api/v1/problems/${prob.id}/mastery`)
        .set('Cookie', userBCookie);

      expect(res.status).toBe(404);
    });
  });

  describe('3. Mastery Evaluation API & Transitions (POST /api/v1/problems/:id/mastery/evaluate)', () => {
    it('transitions UNLOCKED -> LOCKED when all 4 gates pass and creates MasteryEvent', async () => {
      const prob = await createProblem('Merge Intervals', 'Solved');
      const probObjId = new mongoose.Types.ObjectId(prob.id);
      const userObjId = new mongoose.Types.ObjectId(userAId);

      // Seed 3 Spaced Reviews with Stage >= 3 and 2 Cold Solves, latest is EASY
      await RevisionHistory.create([
        {
          userId: userObjId,
          problemId: probObjId,
          reviewedAt: new Date(Date.now() - 30000),
          scheduledReviewAt: new Date(Date.now() - 30000),
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Learning',
          previousNextReviewDate: new Date(Date.now() - 30000),
          newNextReviewDate: new Date(Date.now() - 29000),
          coldSolve: true,
        },
        {
          userId: userObjId,
          problemId: probObjId,
          reviewedAt: new Date(Date.now() - 20000),
          scheduledReviewAt: new Date(Date.now() - 20000),
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 1,
          newStage: 2,
          previousIntervalDays: 1,
          newIntervalDays: 3,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: new Date(Date.now() - 20000),
          newNextReviewDate: new Date(Date.now() - 17000),
          coldSolve: true,
        },
        {
          userId: userObjId,
          problemId: probObjId,
          reviewedAt: new Date(Date.now() - 10000),
          scheduledReviewAt: new Date(Date.now() - 10000),
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 2,
          newStage: 3,
          previousIntervalDays: 3,
          newIntervalDays: 7,
          previousRetention: 'Familiar',
          newRetention: 'Independent',
          previousNextReviewDate: new Date(Date.now() - 10000),
          newNextReviewDate: new Date(Date.now() - 3000),
          coldSolve: false,
        },
      ]);

      // Trigger evaluate
      const evalRes = await request(app)
        .post(`/api/v1/problems/${prob.id}/mastery/evaluate`)
        .set('Cookie', userACookie);

      expect(evalRes.status).toBe(200);
      expect(evalRes.body.success).toBe(true);
      expect(evalRes.body.data.transitioned).toBe(true);
      expect(evalRes.body.data.masteryStatus).toBe('LOCKED');
      expect(evalRes.body.data.lockVersion).toBe(1);
      expect(evalRes.body.data.lockedAt).toBeDefined();

      // Verify DB state
      const dbProblem = await Problem.findById(prob.id);
      expect(dbProblem?.masteryStatus).toBe('LOCKED');
      expect(dbProblem?.lockVersion).toBe(1);
      expect(dbProblem?.lockedAt).toBeDefined();

      // Verify MasteryEvent
      const events = await MasteryEvent.find({ problemId: probObjId, userId: userObjId });
      expect(events.length).toBe(1);
      expect(events[0]?.eventType).toBe('LOCKED');
      expect(events[0]?.reason).toBe('QUALIFICATION_MET');
      expect(events[0]?.lockVersion).toBe(1);

      // Repeated evaluate while LOCKED is idempotent
      const repeatRes = await request(app)
        .post(`/api/v1/problems/${prob.id}/mastery/evaluate`)
        .set('Cookie', userACookie);

      expect(repeatRes.status).toBe(200);
      expect(repeatRes.body.data.transitioned).toBe(false);
      expect(repeatRes.body.data.masteryStatus).toBe('LOCKED');
      expect(repeatRes.body.data.lockVersion).toBe(1);

      // Verify no extra event created
      const eventsAfterRepeat = await MasteryEvent.find({ problemId: probObjId, userId: userObjId });
      expect(eventsAfterRepeat.length).toBe(1);
    });

    it('rejects cross-user evaluation with 404', async () => {
      const prob = await createProblem('Target Problem');

      const res = await request(app)
        .post(`/api/v1/problems/${prob.id}/mastery/evaluate`)
        .set('Cookie', userBCookie);

      expect(res.status).toBe(404);
    });
  });

  describe('4. Post-Event Automatic Demotions & Transitions', () => {
    it('automatically transitions LOCKED -> UNLOCKED on SRS FORGOT or HINT', async () => {
      const prob = await createProblem('LRU Cache', 'Solved');
      const probObjId = new mongoose.Types.ObjectId(prob.id);
      const userObjId = new mongoose.Types.ObjectId(userAId);

      // Manually set to LOCKED with lockVersion 1 (as if previously qualified)
      await Problem.findByIdAndUpdate(prob.id, {
        masteryStatus: 'LOCKED',
        lockedAt: new Date(Date.now() - 60000),
        lockVersion: 1,
      });

      // Submit SRS review with FORGOT
      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId: prob.id,
          recallResult: 'FORGOT',
        });

      expect(reviewRes.status).toBe(200);

      // Problem should now be UNLOCKED with lockVersion 2
      const updatedProb = await Problem.findById(prob.id);
      expect(updatedProb?.masteryStatus).toBe('UNLOCKED');
      expect(updatedProb?.unlockedAt).toBeDefined();
      expect(updatedProb?.lockVersion).toBe(2);

      // Verify MasteryEvent
      const events = await MasteryEvent.find({ problemId: probObjId, userId: userObjId });
      expect(events.length).toBe(1);
      expect(events[0]?.eventType).toBe('UNLOCKED');
      expect(events[0]?.reason).toBe('SRS_FAILURE');
      expect(events[0]?.lockVersion).toBe(2);
    });

    it('is a no-op if problem is already UNLOCKED when SRS failure occurs', async () => {
      const prob = await createProblem('Min Stack', 'Solved');
      const probObjId = new mongoose.Types.ObjectId(prob.id);
      const userObjId = new mongoose.Types.ObjectId(userAId);

      // Ensure UNLOCKED with lockVersion 0
      const initialProb = await Problem.findById(prob.id);
      expect(initialProb?.masteryStatus).toBe('UNLOCKED');
      expect(initialProb?.lockVersion).toBe(0);

      // Submit SRS review with FORGOT
      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId: prob.id,
          recallResult: 'FORGOT',
        });

      expect(reviewRes.status).toBe(200);

      // Problem remains UNLOCKED with unchanged lockVersion 0 and no event
      const probAfter = await Problem.findById(prob.id);
      expect(probAfter?.masteryStatus).toBe('UNLOCKED');
      expect(probAfter?.lockVersion).toBe(0);

      const events = await MasteryEvent.find({ problemId: probObjId, userId: userObjId });
      expect(events.length).toBe(0);
    });
  });

  describe('5. Security & Anti-Tampering', () => {
    it('rejects manual client tampering with masteryStatus or lock fields via problem PATCH', async () => {
      const prob = await createProblem('Secure Problem');

      const res = await request(app)
        .patch(`/api/v1/problems/${prob.id}`)
        .set('Cookie', userACookie)
        .send({
          masteryStatus: 'LOCKED',
          lockVersion: 99,
          lockedAt: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
    });

    it('confirms NO manual unlock endpoint exists', async () => {
      const prob = await createProblem('No Unlock Endpoint Problem');

      const res = await request(app)
        .post(`/api/v1/problems/${prob.id}/mastery/unlock`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(404);
    });
  });

  describe('6. Concurrency & Atomicity', () => {
    it('concurrent evaluate requests on an eligible problem execute safely with exactly one lock transition', async () => {
      const prob = await createProblem('Concurrent Problem', 'Solved');
      const probObjId = new mongoose.Types.ObjectId(prob.id);
      const userObjId = new mongoose.Types.ObjectId(userAId);

      // Seed qualification evidence (3 reviews, stage 3 milestone, 2 cold solves, latest EASY)
      await RevisionHistory.create([
        {
          userId: userObjId,
          problemId: probObjId,
          reviewedAt: new Date(Date.now() - 30000),
          scheduledReviewAt: new Date(Date.now() - 30000),
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 0,
          newStage: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          previousRetention: 'Learning',
          newRetention: 'Learning',
          previousNextReviewDate: new Date(Date.now() - 30000),
          newNextReviewDate: new Date(Date.now() - 29000),
          coldSolve: true,
        },
        {
          userId: userObjId,
          problemId: probObjId,
          reviewedAt: new Date(Date.now() - 20000),
          scheduledReviewAt: new Date(Date.now() - 20000),
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 1,
          newStage: 2,
          previousIntervalDays: 1,
          newIntervalDays: 3,
          previousRetention: 'Learning',
          newRetention: 'Familiar',
          previousNextReviewDate: new Date(Date.now() - 20000),
          newNextReviewDate: new Date(Date.now() - 17000),
          coldSolve: true,
        },
        {
          userId: userObjId,
          problemId: probObjId,
          reviewedAt: new Date(Date.now() - 10000),
          scheduledReviewAt: new Date(Date.now() - 10000),
          recallResult: 'EASY',
          timingStatus: 'ON_TIME',
          latenessDays: 0,
          previousStage: 2,
          newStage: 3,
          previousIntervalDays: 3,
          newIntervalDays: 7,
          previousRetention: 'Familiar',
          newRetention: 'Independent',
          previousNextReviewDate: new Date(Date.now() - 10000),
          newNextReviewDate: new Date(Date.now() - 3000),
          coldSolve: false,
        },
      ]);

      // Fire 5 concurrent evaluate requests
      const results = await Promise.all([
        request(app).post(`/api/v1/problems/${prob.id}/mastery/evaluate`).set('Cookie', userACookie),
        request(app).post(`/api/v1/problems/${prob.id}/mastery/evaluate`).set('Cookie', userACookie),
        request(app).post(`/api/v1/problems/${prob.id}/mastery/evaluate`).set('Cookie', userACookie),
        request(app).post(`/api/v1/problems/${prob.id}/mastery/evaluate`).set('Cookie', userACookie),
        request(app).post(`/api/v1/problems/${prob.id}/mastery/evaluate`).set('Cookie', userACookie),
      ]);

      // All 5 must return 200
      for (const res of results) {
        expect(res.status).toBe(200);
      }

      // Exactly one transitioned: true, remaining transitioned: false
      const transitionedCount = results.filter((r) => r.body.data.transitioned === true).length;
      expect(transitionedCount).toBe(1);

      // LockVersion must be exactly 1
      const finalProb = await Problem.findById(prob.id);
      expect(finalProb?.masteryStatus).toBe('LOCKED');
      expect(finalProb?.lockVersion).toBe(1);

      // Exactly 1 MasteryEvent must exist
      const events = await MasteryEvent.find({ problemId: probObjId, userId: userObjId });
      expect(events.length).toBe(1);
    });

    it('concurrent failure events against a locked problem trigger exactly one unlock transition', async () => {
      const prob = await createProblem('Concurrent Failure Problem', 'Solved');
      const probObjId = new mongoose.Types.ObjectId(prob.id);
      const userObjId = new mongoose.Types.ObjectId(userAId);

      // Set to LOCKED with lockVersion 1
      await Problem.findByIdAndUpdate(prob.id, {
        masteryStatus: 'LOCKED',
        lockedAt: new Date(Date.now() - 60000),
        lockVersion: 1,
      });

      // Fire 5 concurrent unlock calls through service
      const unlockResults = await Promise.all([
        masteryService.unlockProblemIfLocked(userAId, prob.id, 'SRS_FAILURE'),
        masteryService.unlockProblemIfLocked(userAId, prob.id, 'SRS_FAILURE'),
        masteryService.unlockProblemIfLocked(userAId, prob.id, 'SRS_FAILURE'),
        masteryService.unlockProblemIfLocked(userAId, prob.id, 'SRS_FAILURE'),
        masteryService.unlockProblemIfLocked(userAId, prob.id, 'SRS_FAILURE'),
      ]);

      // Exactly one transitioned: true
      const transitionedCount = unlockResults.filter((r) => r.transitioned === true).length;
      expect(transitionedCount).toBe(1);

      // Final lockVersion must be 2
      const finalProb = await Problem.findById(prob.id);
      expect(finalProb?.masteryStatus).toBe('UNLOCKED');
      expect(finalProb?.lockVersion).toBe(2);

      // Exactly 1 UNLOCKED event created
      const events = await MasteryEvent.find({ problemId: probObjId, userId: userObjId });
      expect(events.length).toBe(1);
      expect(events[0]?.eventType).toBe('UNLOCKED');
    });
  });

  describe('7. Filtering & Dashboard Integration', () => {
    it('supports filtering problem list by masteryStatus', async () => {
      const prob1 = await createProblem('Problem Locked 1');
      const prob2 = await createProblem('Problem Unlocked 2');

      // Set prob1 to LOCKED
      await Problem.findByIdAndUpdate(prob1.id, { masteryStatus: 'LOCKED', lockVersion: 1 });

      // Query locked problems
      const lockedRes = await request(app)
        .get('/api/v1/problems?masteryStatus=LOCKED')
        .set('Cookie', userACookie);

      expect(lockedRes.status).toBe(200);
      expect(lockedRes.body.data.items.length).toBe(1);
      expect(lockedRes.body.data.items[0].title).toBe('Problem Locked 1');

      // Query unlocked problems
      const unlockedRes = await request(app)
        .get('/api/v1/problems?masteryStatus=UNLOCKED')
        .set('Cookie', userACookie);

      expect(unlockedRes.status).toBe(200);
      expect(unlockedRes.body.data.items.length).toBe(1);
      expect(unlockedRes.body.data.items[0].title).toBe('Problem Unlocked 2');
    });

    it('returns derived locked and unlocked counts on dashboard endpoint', async () => {
      const p1 = await createProblem('Locked P1');
      const p2 = await createProblem('Locked P2');
      await createProblem('Unlocked P3');

      await Problem.findByIdAndUpdate(p1.id, { masteryStatus: 'LOCKED', lockVersion: 1 });
      await Problem.findByIdAndUpdate(p2.id, { masteryStatus: 'LOCKED', lockVersion: 1 });

      const dashRes = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', userACookie);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.problemStats.total).toBe(3);
      expect(dashRes.body.data.problemStats.locked).toBe(2);
      expect(dashRes.body.data.problemStats.unlocked).toBe(1);
    });
  });
});
