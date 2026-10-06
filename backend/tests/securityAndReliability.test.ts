import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import express, { Express } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.model.js';
import { Problem } from '../src/models/Problem.model.js';
import { ProblemSequence } from '../src/models/ProblemSequence.model.js';
import { ProblemPattern } from '../src/models/ProblemPattern.model.js';
import { RevisionHistory } from '../src/models/RevisionHistory.model.js';
import { MasteryEvent } from '../src/models/MasteryEvent.model.js';
import { Pattern } from '../src/models/Pattern.model.js';
import { problemService } from '../src/services/problem.service.js';
import { problemRepository } from '../src/repositories/problem.repository.js';
import { createAuthRateLimiter } from '../src/middleware/rateLimiter.middleware.js';

describe('Engineering Fix Pass #1: Security, Data Integrity & Reliability', () => {
  let mongoServer: MongoMemoryServer;
  let app: Express;

  let userAId: string;
  let userACookie: string;
  let userBId: string;
  let userBCookie: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = createApp();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Problem.deleteMany({});
    await ProblemSequence.deleteMany({});
    await ProblemPattern.deleteMany({});
    await RevisionHistory.deleteMany({});
    await MasteryEvent.deleteMany({});
    await Pattern.deleteMany({});
    await User.deleteMany({});

    // Create User A
    const regResA = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Engineer',
      email: 'alice@test.com',
      password: 'Password123!',
    });
    userAId = regResA.body.data.user.id;
    userACookie = regResA.headers['set-cookie']![0]!;

    // Create User B
    const regResB = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob Auditor',
      email: 'bob@test.com',
      password: 'Password123!',
    });
    userBId = regResB.body.data.user.id;
    userBCookie = regResB.headers['set-cookie']![0]!;
  });

  // =========================================================================
  // FIX P0-A — PROBLEM DELETION DATA INTEGRITY
  // =========================================================================
  describe('P0-A — Problem Deletion Data Integrity (Cascade Cleanup)', () => {
    it('Test 1: Deleting a problem purges Problem, ProblemPattern, RevisionHistory, and MasteryEvent', async () => {
      // 1. Create a problem
      const pRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Cascade Delete Target',
          topic: 'Graphs',
          difficulty: 'Hard',
          source: 'College',
        });
      const problemId = pRes.body.data.problem.id;

      // 2. Create Pattern & Associate
      const pattern = await Pattern.create({
        name: 'BFS Traversal',
        slug: 'bfs-traversal',
        description: 'Breadth First Search',
        recognitionSignals: ['Shortest path'],
        commonMistakes: ['No visited set'],
      });
      await ProblemPattern.create({
        userId: new mongoose.Types.ObjectId(userAId),
        problemId: new mongoose.Types.ObjectId(problemId),
        patternId: pattern._id,
        confidence: 'HIGH',
      });

      // 3. Log Review via API (which creates a full RevisionHistory document)
      const revRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId,
          recallResult: 'EASY',
          coldSolve: true,
          timeSpentSeconds: 120,
        });
      expect(revRes.status).toBe(200);

      // 4. Create MasteryEvent
      await MasteryEvent.create({
        userId: new mongoose.Types.ObjectId(userAId),
        problemId: new mongoose.Types.ObjectId(problemId),
        occurredAt: new Date(),
        eventType: 'LOCKED',
        reason: 'QUALIFICATION_MET',
        lockVersion: 1,
      });

      // Verify all 4 documents exist in DB before deletion
      expect(await Problem.findById(problemId)).not.toBeNull();
      expect(await ProblemPattern.countDocuments({ problemId })).toBe(1);
      expect(await RevisionHistory.countDocuments({ problemId })).toBe(1);
      expect(await MasteryEvent.countDocuments({ problemId })).toBe(1);

      // 5. Delete the problem via API
      const delRes = await request(app)
        .delete(`/api/v1/problems/${problemId}`)
        .set('Cookie', userACookie);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // 6. Verify zero orphan records remain in DB
      expect(await Problem.findById(problemId)).toBeNull();
      expect(await ProblemPattern.countDocuments({ problemId })).toBe(0);
      expect(await RevisionHistory.countDocuments({ problemId })).toBe(0);
      expect(await MasteryEvent.countDocuments({ problemId })).toBe(0);
    });

    it("Test 2: Attempting to delete another user's problem returns 404 and leaves their data intact", async () => {
      // User A creates a problem
      const pRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: "User A's Protected Problem",
          topic: 'Dynamic Programming',
          difficulty: 'Medium',
          source: 'LeetCode',
        });
      const problemId = pRes.body.data.problem.id;

      // User A logs a review
      await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userACookie)
        .send({
          problemId,
          recallResult: 'EASY',
          coldSolve: true,
        });

      // User B attempts to delete User A's problem
      const delRes = await request(app)
        .delete(`/api/v1/problems/${problemId}`)
        .set('Cookie', userBCookie);

      expect(delRes.status).toBe(404);
      expect(delRes.body.error.code).toBe('NOT_FOUND');

      // User A's data must remain completely intact
      expect(await Problem.findById(problemId)).not.toBeNull();
      expect(await RevisionHistory.countDocuments({ problemId })).toBe(1);
    });

    it('Test 3: Deleting a problem with no history or patterns works cleanly', async () => {
      const pRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Empty Problem',
          topic: 'Trees',
          difficulty: 'Easy',
          source: 'College',
        });
      const problemId = pRes.body.data.problem.id;

      const delRes = await request(app)
        .delete(`/api/v1/problems/${problemId}`)
        .set('Cookie', userACookie);

      expect(delRes.status).toBe(200);
      expect(await Problem.findById(problemId)).toBeNull();
    });

    it('Test 4: Repeated deletion returns 404 without server crash', async () => {
      const pRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Problem for Double Delete',
          topic: 'Strings',
          difficulty: 'Easy',
          source: 'LeetCode',
        });
      const problemId = pRes.body.data.problem.id;

      // First delete -> 200
      const del1 = await request(app)
        .delete(`/api/v1/problems/${problemId}`)
        .set('Cookie', userACookie);
      expect(del1.status).toBe(200);

      // Second delete -> 404
      const del2 = await request(app)
        .delete(`/api/v1/problems/${problemId}`)
        .set('Cookie', userACookie);
      expect(del2.status).toBe(404);
      expect(del2.body.error.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // FIX P0-B — PROBLEM SEQUENCE RELIABILITY
  // =========================================================================
  describe('P0-B — Problem Sequence Reliability & Rollback', () => {
    it('Test 1: Normal sequential creation correctly allocates 1, 2, 3...', async () => {
      const titles = ['First Problem', 'Second Problem', 'Third Problem'];
      const sNos: number[] = [];

      for (const title of titles) {
        const res = await request(app)
          .post('/api/v1/problems')
          .set('Cookie', userACookie)
          .send({
            section: 'COLLEGE',
            title,
            topic: 'Math',
            difficulty: 'Easy',
            source: 'College',
          });
        expect(res.status).toBe(201);
        sNos.push(res.body.data.problem.sNo);
      }

      expect(sNos).toEqual([1, 2, 3]);
    });

    it('Test 2: Failure after sequence allocation rolls back sequence counter', async () => {
      // Spy on problemRepository.create to simulate failure during Problem document insertion
      const createSpy = vi.spyOn(problemRepository, 'create').mockRejectedValueOnce(
        new Error('Database disk error during problem insertion')
      );

      // Attempt creation -> should reject
      await expect(
        problemService.createProblem(userAId, {
          section: 'COLLEGE',
          title: 'Will Fail',
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'College',
          status: 'Not Started',
          retentionLevel: 'Learning',
        })
      ).rejects.toThrow('Database disk error during problem insertion');

      createSpy.mockRestore();

      // Verify the sequence counter was rolled back: next create gets S.No. = 1!
      const successful = await problemService.createProblem(userAId, {
        section: 'COLLEGE',
        title: 'Now Succeeds',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'College',
        status: 'Not Started',
        retentionLevel: 'Learning',
      });

      expect(successful.sNo).toBe(1);
    });

    it('Test 3: Concurrent creation yields non-colliding S.No.s and correct ownership', async () => {
      const count = 5;
      const promises = Array.from({ length: count }, (_, i) =>
        problemService.createProblem(userAId, {
          section: 'PERSONAL',
          title: `Concurrent Problem ${i}`,
          topic: 'Concurrency',
          difficulty: 'Medium',
          source: 'LeetCode',
          status: 'Not Started',
          retentionLevel: 'Learning',
        })
      );

      const created = await Promise.all(promises);
      const sNos = created.map((p) => p.sNo).sort((a, b) => a - b);
      expect(sNos).toEqual([1, 2, 3, 4, 5]);

      for (const p of created) {
        expect(p.userId.toString()).toBe(userAId);
        expect(p.section).toBe('PERSONAL');
      }
    });

    it('Test 4: COLLEGE and PERSONAL sections maintain independent sequence counters', async () => {
      const col1 = await problemService.createProblem(userAId, {
        section: 'COLLEGE',
        title: 'College 1',
        topic: 'Graphs',
        difficulty: 'Easy',
        source: 'College',
        status: 'Not Started',
        retentionLevel: 'Learning',
      });
      const per1 = await problemService.createProblem(userAId, {
        section: 'PERSONAL',
        title: 'Personal 1',
        topic: 'Graphs',
        difficulty: 'Easy',
        source: 'LeetCode',
        status: 'Not Started',
        retentionLevel: 'Learning',
      });
      const col2 = await problemService.createProblem(userAId, {
        section: 'COLLEGE',
        title: 'College 2',
        topic: 'Graphs',
        difficulty: 'Medium',
        source: 'College',
        status: 'Not Started',
        retentionLevel: 'Learning',
      });

      expect(col1.sNo).toBe(1);
      expect(per1.sNo).toBe(1);
      expect(col2.sNo).toBe(2);
    });
  });

  // =========================================================================
  // FIX P0-C — REGEX INJECTION / ReDoS RISK
  // =========================================================================
  describe('P0-C — Topic Regex Escaping & ReDoS Protection', () => {
    beforeEach(async () => {
      // Seed problems with diverse topics, including regex metacharacters
      const topics = [
        'Binary Search',
        'Array & Sorting',
        'array+$',
        'Regex .* Metacharacters',
        'C++ (STL)',
      ];

      for (const topic of topics) {
        await problemService.createProblem(userAId, {
          section: 'PERSONAL',
          title: `Problem on ${topic}`,
          topic,
          difficulty: 'Medium',
          source: 'LeetCode',
          status: 'Not Started',
          retentionLevel: 'Learning',
        });
      }
    });

    it('1. Normal topic search matches exactly', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .query({ topic: 'Binary Search' })
        .set('Cookie', userACookie);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].topic).toBe('Binary Search');
    });

    it('2. Partial topic search matches substrings', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .query({ topic: 'Search' })
        .set('Cookie', userACookie);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].topic).toBe('Binary Search');
    });

    it('3. Case-insensitive topic search matches regardless of casing', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .query({ topic: 'binary search' })
        .set('Cookie', userACookie);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].topic).toBe('Binary Search');
    });

    it('4. Regex metacharacters like "array+$" are treated literally', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .query({ topic: 'array+$' })
        .set('Cookie', userACookie);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].topic).toBe('array+$');
    });

    it('5. Wildcard ".*" is treated literally and does not match all items', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .query({ topic: '.*' })
        .set('Cookie', userACookie);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].topic).toBe('Regex .* Metacharacters');
    });

    it('6. Malicious repeated regex like "((a+)+)+$" does not cause ReDoS or server error', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .query({ topic: '((a+)+)+$' })
        .set('Cookie', userACookie);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(0);
    });

    it('7. Empty or undefined topic query returns all problems', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .set('Cookie', userACookie);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(5);
    });
  });

  // =========================================================================
  // FIX P0-D — AUTH RATE LIMITING
  // =========================================================================
  describe('P0-D — Authentication Rate Limiting & Brute-Force Protection', () => {
    it('1. Normal login returns 200 and sets session cookie', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'alice@test.com',
        password: 'Password123!',
      });
      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('2. Failed login returns 401 with standard message without information leakage', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'alice@test.com',
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Invalid email or password/i);
    });

    it('3. Excessive requests trigger HTTP 429 TOO_MANY_REQUESTS with standard headers', async () => {
      // Test isolated router configured with a tight max limit to avoid flakiness
      const testLimiterApp = express();
      testLimiterApp.use(express.json());
      const testLimiter = createAuthRateLimiter({ max: 3, windowMs: 60000 });
      testLimiterApp.post('/test-login', testLimiter, (_req, res) => {
        res.json({ success: true });
      });

      // 1st request -> 200
      const r1 = await request(testLimiterApp).post('/test-login').send({});
      expect(r1.status).toBe(200);
      expect(r1.headers['ratelimit-limit']).toBe('3');

      // 2nd request -> 200
      const r2 = await request(testLimiterApp).post('/test-login').send({});
      expect(r2.status).toBe(200);

      // 3rd request -> 200
      const r3 = await request(testLimiterApp).post('/test-login').send({});
      expect(r3.status).toBe(200);

      // 4th request -> 429
      const r4 = await request(testLimiterApp).post('/test-login').send({});
      expect(r4.status).toBe(429);
      expect(r4.body).toEqual({
        success: false,
        error: {
          message: 'Too many authentication attempts. Please try again later.',
          code: 'TOO_MANY_REQUESTS',
        },
      });
      expect(r4.headers['ratelimit-limit']).toBe('3');
      expect(r4.headers['ratelimit-remaining']).toBe('0');
    });

    it('4. Rate limiter does not block unrelated endpoints (e.g. /api/v1/health)', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
    });
  });

  // =========================================================================
  // FIX P0-E — DUPLICATE PATTERN IDS VALIDATION
  // =========================================================================
  describe('P0-E — Pattern Synchronization Duplicate ID Validation', () => {
    let problemId: string;
    let patAId: string;
    let patBId: string;

    beforeEach(async () => {
      const pRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Pattern Sync Target',
          topic: 'Sliding Window',
          difficulty: 'Medium',
          source: 'LeetCode',
        });
      problemId = pRes.body.data.problem.id;

      const pA = await Pattern.create({
        name: 'Sliding Window',
        slug: 'sliding-window',
        description: 'Window technique',
        recognitionSignals: ['Subarray problems'],
        commonMistakes: ['Window edge conditions'],
      });
      const pB = await Pattern.create({
        name: 'Two Pointers',
        slug: 'two-pointers',
        description: 'Two pointers technique',
        recognitionSignals: ['Sorted array targets'],
        commonMistakes: ['Pointer off-by-one'],
      });
      patAId = pA._id.toString();
      patBId = pB._id.toString();
    });

    it('1. Unique pattern IDs synchronize successfully', async () => {
      const res = await request(app)
        .put(`/api/v1/problems/${problemId}/patterns/sync`)
        .set('Cookie', userACookie)
        .send({
          patterns: [
            { patternId: patAId, confidence: 'HIGH', isPrimary: true },
            { patternId: patBId, confidence: 'MEDIUM', isPrimary: false },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('2. Duplicate pattern IDs in the same request return HTTP 400 validation error', async () => {
      const res = await request(app)
        .put(`/api/v1/problems/${problemId}/patterns/sync`)
        .set('Cookie', userACookie)
        .send({
          patterns: [
            { patternId: patAId, confidence: 'HIGH', isPrimary: true },
            { patternId: patAId, confidence: 'LOW', isPrimary: false },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Duplicate pattern IDs are not allowed');
    });

    it('3. Empty array clears pattern associations cleanly', async () => {
      // First attach patA
      await request(app)
        .put(`/api/v1/problems/${problemId}/patterns/sync`)
        .set('Cookie', userACookie)
        .send({
          patterns: [{ patternId: patAId, confidence: 'HIGH' }],
        });

      // Now sync with empty array
      const res = await request(app)
        .put(`/api/v1/problems/${problemId}/patterns/sync`)
        .set('Cookie', userACookie)
        .send({ patterns: [] });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(await ProblemPattern.countDocuments({ problemId })).toBe(0);
    });

    it('4. Malformed pattern ID returns HTTP 400 validation error', async () => {
      const res = await request(app)
        .put(`/api/v1/problems/${problemId}/patterns/sync`)
        .set('Cookie', userACookie)
        .send({
          patterns: [{ patternId: 'not-a-valid-object-id', confidence: 'HIGH' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Invalid ID format');
    });

    it("5. User B cannot sync patterns on User A's problem", async () => {
      const res = await request(app)
        .put(`/api/v1/problems/${problemId}/patterns/sync`)
        .set('Cookie', userBCookie)
        .send({
          patterns: [{ patternId: patAId, confidence: 'HIGH' }],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // SECURITY REGRESSION TESTS
  // =========================================================================
  describe('Security Regression Suite: Ownership, Controlled Fields, and Auth Tokens', () => {
    let userAProblemId: string;
    let patternId: string;

    beforeEach(async () => {
      const pRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Protected Problem',
          topic: 'Heap',
          difficulty: 'Hard',
          source: 'LeetCode',
        });
      userAProblemId = pRes.body.data.problem.id;

      const p = await Pattern.create({
        name: 'Min Heap',
        slug: 'min-heap',
        description: 'Heap data structure',
        recognitionSignals: ['Kth largest element'],
        commonMistakes: ['Heap invariant violation'],
      });
      patternId = p._id.toString();
    });

    it('Ownership Isolation: User B cannot read, update, delete, attach patterns, or review User A problem', async () => {
      // Read -> 404
      const readRes = await request(app)
        .get(`/api/v1/problems/${userAProblemId}`)
        .set('Cookie', userBCookie);
      expect(readRes.status).toBe(404);

      // Update -> 404
      const updateRes = await request(app)
        .patch(`/api/v1/problems/${userAProblemId}`)
        .set('Cookie', userBCookie)
        .send({ title: 'Hacked Title' });
      expect(updateRes.status).toBe(404);

      // Attach Pattern -> 404
      const attachRes = await request(app)
        .post(`/api/v1/problems/${userAProblemId}/patterns`)
        .set('Cookie', userBCookie)
        .send({ patternId });
      expect(attachRes.status).toBe(404);

      // Review -> 404
      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userBCookie)
        .send({
          problemId: userAProblemId,
          recallResult: 'EASY',
          coldSolve: true,
        });
      expect(reviewRes.status).toBe(404);

      // Delete -> 404
      const deleteRes = await request(app)
        .delete(`/api/v1/problems/${userAProblemId}`)
        .set('Cookie', userBCookie);
      expect(deleteRes.status).toBe(404);
    });

    it('Server-controlled fields cannot be overridden by client injection', async () => {
      const maliciousUserId = new mongoose.Types.ObjectId().toString();

      // Client attempts to spoof userId, sNo, masteryStatus during creation
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          userId: maliciousUserId,
          sNo: 99999,
          masteryStatus: 'LOCKED',
          section: 'PERSONAL',
          title: 'Injection Test',
          topic: 'Security',
          difficulty: 'Easy',
          source: 'LeetCode',
        });

      expect(res.status).toBe(201);
      const created = res.body.data.problem;
      expect(created.userId).toBe(userAId); // Not maliciousUserId
      expect(created.sNo).not.toBe(99999); // Server sequence allocated
      expect(created.masteryStatus).toBe('UNLOCKED'); // Default server status
    });

    it('Authentication tokens: invalid, expired, and missing tokens are rejected', async () => {
      // Missing token -> 401
      const noAuth = await request(app).get('/api/v1/auth/me');
      expect(noAuth.status).toBe(401);

      // Invalid token -> 401
      const invalidAuth = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', 'token=invalid.jwt.signature');
      expect(invalidAuth.status).toBe(401);

      // Expired token -> 401
      const expiredToken = jwt.sign(
        { userId: userAId, email: 'alice@test.com' },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );
      const expiredAuth = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `token=${expiredToken}`);
      expect(expiredAuth.status).toBe(401);
    });

    it('Password hash is never returned in auth endpoints and logout clears cookie', async () => {
      // Me endpoint
      const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', userACookie);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.password).toBeUndefined();
      expect(meRes.body.data.user.passwordHash).toBeUndefined();

      // Logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', userACookie);
      expect(logoutRes.status).toBe(200);
      // Cookie is cleared
      const cookieHeader = logoutRes.headers['set-cookie']?.[0] || '';
      expect(cookieHeader).toMatch(/token=;/);
    });
  });
});
