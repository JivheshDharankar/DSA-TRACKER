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

describe('Pattern Library & Mastery Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();
  let user1Cookie: string;
  let user2Cookie: string;
  let user1Id: string;
  let user2Id: string;
  let patternTwoPointersId: string;
  let patternSlidingWindowId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Seed initial 30 patterns
    await seedPatterns();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
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

    // Retrieve pattern IDs
    const tp = await Pattern.findOne({ slug: 'two-pointers' });
    patternTwoPointersId = tp!._id.toString();

    const sw = await Pattern.findOne({ slug: 'sliding-window' });
    patternSlidingWindowId = sw!._id.toString();
  });

  describe('Seed Idempotency', () => {
    it('should maintain exactly 30 patterns even when seedPatterns is called repeatedly', async () => {
      await seedPatterns();
      await seedPatterns();
      const count = await Pattern.countDocuments();
      expect(count).toBe(30);
    });
  });

  describe('GET /api/v1/patterns', () => {
    it('should return all patterns with 0 mastery for a user with no problems', async () => {
      const res = await request(app)
        .get('/api/v1/patterns')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(30);
      expect(res.body.data[0].mastery.score).toBe(0);
      expect(res.body.data[0].mastery.masteryLevel).toBe('Learning');
      expect(res.body.data[0].mastery.problemCount).toBe(0);
    });

    it('should filter patterns using search query parameter', async () => {
      const res = await request(app)
        .get('/api/v1/patterns?search=sliding')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.some((p: { slug: string }) => p.slug === 'sliding-window')).toBe(true);
    });

    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/patterns');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/patterns/:id', () => {
    it('should return pattern details, breakdown, and associated problems', async () => {
      // User 1 creates a problem and attaches two-pointers
      const probRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user1Cookie)
        .send({
          title: 'Pair with Target Sum',
          section: 'COLLEGE',
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'LeetCode',
          status: 'Solved',
        });
      const problemId = probRes.body.data.problem.id;

      await request(app)
        .post(`/api/v1/problems/${problemId}/patterns`)
        .set('Cookie', user1Cookie)
        .send({
          patternId: patternTwoPointersId,
          confidence: 'HIGH',
          isPrimary: true,
        });

      const res = await request(app)
        .get(`/api/v1/patterns/${patternTwoPointersId}`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.pattern.name).toBe('Two Pointers');
      expect(res.body.data.mastery.problemCount).toBe(1);
      expect(res.body.data.mastery.solvedCount).toBe(1);
      expect(res.body.data.associatedProblems.length).toBe(1);
      expect(res.body.data.associatedProblems[0].problem.title).toBe('Pair with Target Sum');
      expect(res.body.data.associatedProblems[0].confidence).toBe('HIGH');
      expect(res.body.data.associatedProblems[0].isPrimary).toBe(true);
    });

    it('should allow fetching by slug', async () => {
      const res = await request(app)
        .get('/api/v1/patterns/two-pointers')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.pattern.slug).toBe('two-pointers');
    });

    it('should return 404 for invalid/unknown pattern ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/patterns/${fakeId}`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(404);
    });
  });

  describe('Problem Pattern Association CRUD', () => {
    let user1ProblemId: string;

    beforeEach(async () => {
      const probRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user1Cookie)
        .send({
          title: '3Sum',
          section: 'PERSONAL',
          topic: 'Arrays',
          difficulty: 'Medium',
          source: 'LeetCode',
          status: 'Solved',
        });
      user1ProblemId = probRes.body.data.problem.id;
    });

    it('should attach a pattern to a problem', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user1Cookie)
        .send({
          patternId: patternTwoPointersId,
          confidence: 'HIGH',
          isPrimary: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.patternId).toBe(patternTwoPointersId);
    });

    it('should reject duplicate pattern attachment with 409 Conflict', async () => {
      await request(app)
        .post(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user1Cookie)
        .send({
          patternId: patternTwoPointersId,
          confidence: 'MEDIUM',
        });

      const res = await request(app)
        .post(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user1Cookie)
        .send({
          patternId: patternTwoPointersId,
          confidence: 'HIGH',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already attached');
    });

    it('should retrieve all patterns attached to a problem', async () => {
      await request(app)
        .post(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user1Cookie)
        .send({ patternId: patternTwoPointersId });

      await request(app)
        .post(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user1Cookie)
        .send({ patternId: patternSlidingWindowId });

      const res = await request(app)
        .get(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.map((p: { pattern: { slug: string } }) => p.pattern.slug)).toEqual(
        expect.arrayContaining(['two-pointers', 'sliding-window'])
      );
    });

    it('should detach a pattern from a problem', async () => {
      await request(app)
        .post(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user1Cookie)
        .send({ patternId: patternTwoPointersId });

      const delRes = await request(app)
        .delete(`/api/v1/problems/${user1ProblemId}/patterns/${patternTwoPointersId}`)
        .set('Cookie', user1Cookie);

      expect(delRes.status).toBe(200);

      const listRes = await request(app)
        .get(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user1Cookie);

      expect(listRes.body.data.length).toBe(0);
    });

    it('should sync patterns for a problem atomically', async () => {
      // First attach two-pointers
      await request(app)
        .post(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user1Cookie)
        .send({ patternId: patternTwoPointersId });

      // Sync to replace with sliding-window only
      const syncRes = await request(app)
        .put(`/api/v1/problems/${user1ProblemId}/patterns/sync`)
        .set('Cookie', user1Cookie)
        .send({
          patterns: [{ patternId: patternSlidingWindowId, confidence: 'HIGH', isPrimary: true }],
        });

      expect(syncRes.status).toBe(200);
      expect(syncRes.body.data.length).toBe(1);
      const patId = syncRes.body.data[0].patternId?.id || syncRes.body.data[0].patternId?._id || syncRes.body.data[0].patternId;
      expect(patId.toString()).toBe(patternSlidingWindowId);
    });
  });

  describe('User Privacy & Cross-User Isolation', () => {
    let user1ProblemId: string;

    beforeEach(async () => {
      const probRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user1Cookie)
        .send({
          title: 'User 1 Private Problem',
          section: 'PERSONAL',
          topic: 'Strings',
          difficulty: 'Hard',
          source: 'LeetCode',
          status: 'Solved',
        });
      user1ProblemId = probRes.body.data.problem.id;

      // User 1 attaches two-pointers and submits an EASY cold solve review
      await request(app)
        .post(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user1Cookie)
        .send({ patternId: patternTwoPointersId });

      await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', user1Cookie)
        .send({
          problemId: user1ProblemId,
          recallResult: 'EASY',
          coldSolve: true,
          notes: 'Solved smoothly',
        });
    });

    it('User 2 querying the pattern must see 0 score, 0 problems, and no leaked data from User 1', async () => {
      const res = await request(app)
        .get(`/api/v1/patterns/${patternTwoPointersId}`)
        .set('Cookie', user2Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.mastery.score).toBe(0);
      expect(res.body.data.mastery.problemCount).toBe(0);
      expect(res.body.data.associatedProblems).toEqual([]);
    });

    it('User 2 cannot attach patterns to User 1 problem', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user2Cookie)
        .send({ patternId: patternTwoPointersId });

      expect(res.status).toBe(404);
    });

    it('User 2 cannot view patterns attached to User 1 problem', async () => {
      const res = await request(app)
        .get(`/api/v1/problems/${user1ProblemId}/patterns`)
        .set('Cookie', user2Cookie);

      expect(res.status).toBe(404);
    });

    it('User 2 cannot detach patterns from User 1 problem', async () => {
      const res = await request(app)
        .delete(`/api/v1/problems/${user1ProblemId}/patterns/${patternTwoPointersId}`)
        .set('Cookie', user2Cookie);

      expect(res.status).toBe(404);
    });

    it('Deleting a problem cleans up problem pattern associations', async () => {
      const ppCountBefore = await ProblemPattern.countDocuments({ problemId: user1ProblemId });
      expect(ppCountBefore).toBe(1);

      await request(app)
        .delete(`/api/v1/problems/${user1ProblemId}`)
        .set('Cookie', user1Cookie);

      const ppCountAfter = await ProblemPattern.countDocuments({ problemId: user1ProblemId });
      expect(ppCountAfter).toBe(0);
    });
  });
});
