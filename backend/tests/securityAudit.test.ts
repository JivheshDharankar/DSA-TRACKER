import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { Problem } from '../src/models/Problem.model.js';
import { RevisionHistory } from '../src/models/RevisionHistory.model.js';
import { ProblemPattern } from '../src/models/ProblemPattern.model.js';
import { Pattern } from '../src/models/Pattern.model.js';
import { seedPatterns } from '../src/seeds/patterns.seed.js';
import { env } from '../src/config/env.js';
import { AUTH_COOKIE_NAME } from '../src/config/cookie.config.js';
import { createDashboardRateLimiter } from '../src/middleware/rateLimiter.middleware.js';
import express from 'express';

describe('Phase 7: Deep Security Audit & Adversarial Hardening Suite', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    await seedPatterns();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Problem.deleteMany({});
    await RevisionHistory.deleteMany({});
    await ProblemPattern.deleteMany({});
  });

  // Helper to register and get cookie
  const registerUser = async (email: string, name: string = 'Test User') => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name,
        email,
        password: 'Password123!',
      });
    expect(res.status).toBe(201);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const authCookie = Array.isArray(cookies) ? cookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`)) : undefined;
    const token = authCookie ? authCookie.split(';')[0]?.split('=')[1] : undefined;
    return {
      userId: res.body.data.user.id,
      email,
      name,
      cookie: authCookie,
      token,
    };
  };

  // ==========================================
  // 1. AUTHENTICATION BOUNDARY
  // ==========================================
  describe('1. Authentication Boundary & Credential Security', () => {
    it('rejects unauthenticated request to protected resource with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/v1/problems');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('Authentication required');
    });

    it('rejects expired JWT token with 401 TOKEN_EXPIRED', async () => {
      const user = await registerUser('expired@example.com');
      const expiredToken = jwt.sign({ userId: user.userId }, env.JWT_SECRET, { expiresIn: '-1s' });

      const res = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('rejects malformed JWT token with 401 INVALID_TOKEN', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', 'Bearer invalid.malformed.token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects token signed with wrong secret with 401 INVALID_TOKEN', async () => {
      const user = await registerUser('forged@example.com');
      const forgedToken = jwt.sign({ userId: user.userId }, 'wrong_secret_1234567890');

      const res = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('prevents account enumeration by returning identical error for invalid password and non-existent user', async () => {
      await registerUser('existing@example.com');

      // Attempt login with existing email, wrong password
      const wrongPassRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'existing@example.com', password: 'WrongPassword!' });

      // Attempt login with non-existent email
      const wrongEmailRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'SomePassword123!' });

      expect(wrongPassRes.status).toBe(401);
      expect(wrongEmailRes.status).toBe(401);
      expect(wrongPassRes.body.error.message).toBe('Invalid email or password.');
      expect(wrongEmailRes.body.error.message).toBe('Invalid email or password.');
      expect(wrongPassRes.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrongEmailRes.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('never leaks passwordHash in register, login, or getMe responses', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Safe User', email: 'safe@example.com', password: 'Password123!' });
      expect(regRes.body.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(regRes.body)).not.toContain('passwordHash');

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'safe@example.com', password: 'Password123!' });
      expect(loginRes.body.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(loginRes.body)).not.toContain('passwordHash');

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const cookieHeader = Array.isArray(cookies) ? cookies[0] : '';
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', cookieHeader || '');
      expect(meRes.body.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(meRes.body)).not.toContain('passwordHash');
    });
  });

  // ==========================================
  // 2. AUTHORIZATION & IDOR (TWO-USER ISOLATION)
  // ==========================================
  describe('2. Authorization & IDOR Cross-User Boundary (User A vs User B)', () => {
    it('strictly denies cross-user read, update, delete, review, pattern, and mastery operations', async () => {
      const userA = await registerUser('usera@example.com', 'User A');
      const userB = await registerUser('userb@example.com', 'User B');

      // User A creates a problem
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userA.cookie!)
        .send({
          section: 'COLLEGE',
          title: "User A's Private Problem",
          topic: 'Arrays',
          difficulty: 'Medium',
          source: 'LeetCode',
        });
      expect(createRes.status).toBe(201);
      const problemAId = createRes.body.data.problem.id;

      // 1. User B attempts GET /problems/:id -> 404 NOT_FOUND (no existence leakage)
      const readRes = await request(app)
        .get(`/api/v1/problems/${problemAId}`)
        .set('Cookie', userB.cookie!);
      expect(readRes.status).toBe(404);
      expect(readRes.body.error.code).toBe('NOT_FOUND');

      // 2. User B attempts PATCH /problems/:id -> 404 NOT_FOUND
      const updateRes = await request(app)
        .patch(`/api/v1/problems/${problemAId}`)
        .set('Cookie', userB.cookie!)
        .send({ title: "Attacker's Tampered Title" });
      expect(updateRes.status).toBe(404);

      // Verify User A's problem title was NOT modified
      const checkA = await Problem.findById(problemAId);
      expect(checkA?.title).toBe("User A's Private Problem");

      // 3. User B attempts POST /reviews on User A's problem -> 404 NOT_FOUND
      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', userB.cookie!)
        .send({
          problemId: problemAId,
          recallResult: 'EASY',
        });
      expect(reviewRes.status).toBe(404);

      // Verify no review was recorded
      const reviewsCount = await RevisionHistory.countDocuments({ problemId: problemAId });
      expect(reviewsCount).toBe(0);

      // 4. User B attempts GET /reviews/problem/:id -> 404 NOT_FOUND
      const revHistRes = await request(app)
        .get(`/api/v1/reviews/problem/${problemAId}`)
        .set('Cookie', userB.cookie!);
      expect(revHistRes.status).toBe(404);

      // 5. User B attempts pattern attachment on User A's problem -> 404 NOT_FOUND
      const pattern = await Pattern.findOne();
      expect(pattern).not.toBeNull();
      const attachRes = await request(app)
        .post(`/api/v1/problems/${problemAId}/patterns`)
        .set('Cookie', userB.cookie!)
        .send({ patternId: pattern!._id.toString() });
      expect(attachRes.status).toBe(404);

      // 6. User B attempts pattern sync on User A's problem -> 404 NOT_FOUND
      const syncRes = await request(app)
        .put(`/api/v1/problems/${problemAId}/patterns/sync`)
        .set('Cookie', userB.cookie!)
        .send({ patterns: [{ patternId: pattern!._id.toString() }] });
      expect(syncRes.status).toBe(404);

      // 7. User B attempts GET mastery on User A's problem -> 404 NOT_FOUND
      const masteryGetRes = await request(app)
        .get(`/api/v1/problems/${problemAId}/mastery`)
        .set('Cookie', userB.cookie!);
      expect(masteryGetRes.status).toBe(404);

      // 8. User B attempts POST evaluate mastery on User A's problem -> 404 NOT_FOUND
      const masteryEvalRes = await request(app)
        .post(`/api/v1/problems/${problemAId}/mastery/evaluate`)
        .set('Cookie', userB.cookie!);
      expect(masteryEvalRes.status).toBe(404);

      // 9. User B attempts DELETE /problems/:id -> 404 NOT_FOUND
      const deleteRes = await request(app)
        .delete(`/api/v1/problems/${problemAId}`)
        .set('Cookie', userB.cookie!);
      expect(deleteRes.status).toBe(404);

      // Verify User A's problem still exists
      const intactProblem = await Problem.findById(problemAId);
      expect(intactProblem).not.toBeNull();
    });
  });

  // ==========================================
  // 3. MASS ASSIGNMENT & SERVER-CONTROLLED FIELDS
  // ==========================================
  describe('3. Mass Assignment & Server-Controlled Fields (Full Boundary Test)', () => {
    it('ensures client-supplied server-controlled fields are stripped/ignored and server authoritatively governs state', async () => {
      const attacker = await registerUser('attacker@example.com', 'Attacker');
      const victim = await registerUser('victim@example.com', 'Victim');

      // 1. Submit request containing client-attempted server fields
      const maliciousPayload = {
        section: 'COLLEGE',
        title: 'Forged Problem',
        topic: 'Dynamic Programming',
        difficulty: 'Hard',
        source: 'LeetCode',
        userId: victim.userId, // Attempting to assign to victim
        _id: new mongoose.Types.ObjectId().toString(),
        sNo: 99999, // Attempting to forge S.No.
        repetitionStage: 9, // Attempting to forge high repetition stage
        intervalDays: 365, // Attempting to forge 1-year interval
        nextReviewDate: '2099-01-01T00:00:00.000Z',
        lastReviewedAt: '2026-01-01T00:00:00.000Z',
        recoveryStage: 3,
        masteryStatus: 'LOCKED', // Attempting to bypass 4-gate mastery evaluation
        lockVersion: 99,
        lockedAt: '2026-01-01T00:00:00.000Z',
      };

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', attacker.cookie!)
        .send(maliciousPayload);

      // 2. Request succeeds with server-controlled fields safely initialized
      expect(res.status).toBe(201);
      const createdProb = res.body.data.problem;

      // 3. Verify server-generated fields are actually governed by server, NOT the attacker
      expect(createdProb.userId).toBe(attacker.userId);
      expect(createdProb.userId).not.toBe(victim.userId);
      expect(createdProb.sNo).toBe(1); // Server-allocated sequence, not 99999
      expect(createdProb.repetitionStage).toBe(0); // Day-0 initialized, not 9
      expect(createdProb.intervalDays).toBe(0); // Day-0 initialized, not 365
      expect(createdProb.masteryStatus).toBe('UNLOCKED'); // Server-initialized, not forged LOCKED
      expect(createdProb.lockVersion).toBe(0); // Server-initialized, not 99
      expect(createdProb.lockedAt).toBeNull(); // Server-initialized, not forged date

      // 4. Verify in database directly
      const dbProb = await Problem.findById(createdProb.id);
      expect(dbProb?.userId.toString()).toBe(attacker.userId);
      expect(dbProb?.sNo).toBe(1);
      expect(dbProb?.repetitionStage).toBe(0);
      expect(dbProb?.masteryStatus).toBe('UNLOCKED');
    });

    it('rejects unexpected fields on problem update (strict schema enforcement)', async () => {
      const user = await registerUser('updater@example.com');
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'Original Title',
          topic: 'Trees',
          difficulty: 'Easy',
          source: 'Striver SDE',
        });
      const problemId = createRes.body.data.problem.id;

      // Attempt to tamper with server-controlled fields via PATCH
      const patchRes = await request(app)
        .patch(`/api/v1/problems/${problemId}`)
        .set('Cookie', user.cookie!)
        .send({
          repetitionStage: 8,
          masteryStatus: 'LOCKED',
          sNo: 100,
        });

      expect(patchRes.status).toBe(400);
      expect(patchRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects server-controlled fields on review submission (strict schema enforcement)', async () => {
      const user = await registerUser('reviewer@example.com');
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'Review Problem',
          topic: 'Graphs',
          difficulty: 'Medium',
          source: 'LeetCode',
        });
      const problemId = createRes.body.data.problem.id;

      // Attempt to inject calculated schedule state into review submission
      const reviewRes = await request(app)
        .post('/api/v1/reviews')
        .set('Cookie', user.cookie!)
        .send({
          problemId,
          recallResult: 'EASY',
          newStage: 10,
          newIntervalDays: 180,
          nextReviewDate: '2030-01-01T00:00:00.000Z',
        });

      expect(reviewRes.status).toBe(400);
      expect(reviewRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects unexpected fields on pattern synchronization (strict schema enforcement)', async () => {
      const user = await registerUser('patternuser@example.com');
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'Pattern Problem',
          topic: 'Strings',
          difficulty: 'Easy',
          source: 'LeetCode',
        });
      const problemId = createRes.body.data.problem.id;
      const pattern = await Pattern.findOne();

      const syncRes = await request(app)
        .put(`/api/v1/problems/${problemId}/patterns/sync`)
        .set('Cookie', user.cookie!)
        .send({
          patterns: [{
            patternId: pattern!._id.toString(),
            confidence: 'HIGH',
            isPrimary: true,
            tamperedField: 'malicious',
          }],
          unexpectedOuterField: 'exploit',
        });

      expect(syncRes.status).toBe(400);
      expect(syncRes.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ==========================================
  // 4. URL & SCHEME INJECTION
  // ==========================================
  describe('4. URL & Scheme Injection Boundary (Test Matrix)', () => {
    it('allows valid HTTPS and HTTP URLs', async () => {
      const user = await registerUser('url_ok@example.com');

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'Valid URL Problem',
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'College Portal',
          collegeLink: 'http://college.edu/dsa/problem1',
          leetcodeLink: 'https://leetcode.com/problems/two-sum/',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.problem.collegeLink).toBe('http://college.edu/dsa/problem1');
      expect(res.body.data.problem.leetcodeLink).toBe('https://leetcode.com/problems/two-sum/');
    });

    it('rejects javascript: URL scheme with 400 VALIDATION_ERROR', async () => {
      const user = await registerUser('url_js@example.com');

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'XSS Attempt',
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'College Portal',
          collegeLink: 'javascript:alert(document.cookie)',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Must be a valid web URL starting with http:// or https://');
    });

    it('rejects data: URL scheme with 400 VALIDATION_ERROR', async () => {
      const user = await registerUser('url_data@example.com');

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'Data Scheme Attempt',
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'College Portal',
          collegeLink: 'data:text/html,<script>alert(1)</script>',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects vbscript: URL scheme with 400 VALIDATION_ERROR', async () => {
      const user = await registerUser('url_vbs@example.com');

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'VBScript Attempt',
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'College Portal',
          collegeLink: 'vbscript:msgbox(1)',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects file: URL scheme with 400 VALIDATION_ERROR', async () => {
      const user = await registerUser('url_file@example.com');

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'File Scheme Attempt',
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'College Portal',
          collegeLink: 'file:///etc/passwd',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects protocol-relative URL (//example.com) with 400 VALIDATION_ERROR', async () => {
      const user = await registerUser('url_proto@example.com');

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'Protocol Relative Attempt',
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'College Portal',
          collegeLink: '//example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects malformed URL with 400 VALIDATION_ERROR', async () => {
      const user = await registerUser('url_mal@example.com');

      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'Malformed URL',
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'College Portal',
          collegeLink: 'htt:not-a-url',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ==========================================
  // 5. INJECTION & QUERY HARDENING
  // ==========================================
  describe('5. Injection, Regex Safety & Query Hardening', () => {
    it('safely handles regex metacharacters in search and topic without 500 error or ReDoS', async () => {
      const user = await registerUser('regex_safe@example.com');

      // Create a test problem
      await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: 'Problem with special characters (v1.0) [Solved] + More',
          topic: 'C++ & Java (Basics)',
          difficulty: 'Easy',
          source: 'LeetCode',
        });

      // Search with metacharacters: . * + ? ^ $ { } ( ) | [ ] \
      const maliciousPatterns = [
        '.*',
        '([a-zA-Z]+)*',
        '++++++++++',
        '[[[(((',
        '\\',
        '^.*$',
      ];

      for (const pattern of maliciousPatterns) {
        const res = await request(app)
          .get('/api/v1/problems')
          .set('Cookie', user.cookie!)
          .query({ search: pattern });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
    });

    it('rejects oversized search string (> 200 chars) with 400 VALIDATION_ERROR', async () => {
      const user = await registerUser('oversized@example.com');
      const hugeSearch = 'A'.repeat(250);

      const res = await request(app)
        .get('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .query({ search: hugeSearch });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Search query cannot exceed 200 characters');
    });

    it('rejects oversized topic query string (> 200 chars) with 400 VALIDATION_ERROR', async () => {
      const user = await registerUser('oversized_topic@example.com');
      const hugeTopic = 'B'.repeat(250);

      const res = await request(app)
        .get('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .query({ topic: hugeTopic });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Topic filter cannot exceed 200 characters');
    });

    it('rejects MongoDB operator payload injection where strings are expected', async () => {
      const user = await registerUser('nosql@example.com');

      // Attempt NoSQL injection in body
      const resBody = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', user.cookie!)
        .send({
          section: 'COLLEGE',
          title: { $gt: '' }, // Object injected where string expected
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'LeetCode',
        });

      expect(resBody.status).toBe(400);
      expect(resBody.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ==========================================
  // 6. SECURITY HEADERS & CORS
  // ==========================================
  describe('6. Security Headers & CORS Protection', () => {
    it('sets critical security headers (X-Content-Type-Options, X-Frame-Options)', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);

      // X-Content-Type-Options nosniff
      expect(res.headers['x-content-type-options']).toBe('nosniff');

      // X-Frame-Options SAMEORIGIN
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('returns Access-Control-Allow-Origin matching client URL and does not allow wildcard with credentials', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', env.CLIENT_URL);

      expect(res.headers['access-control-allow-origin']).toBe(env.CLIENT_URL);
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  // ==========================================
  // 7. RATE LIMITING (DASHBOARD & AUTH)
  // ==========================================
  describe('7. Rate Limiting Protection', () => {
    it('enforces rate limits on dashboard aggregation and returns 429 when threshold exceeded', async () => {
      // Create a test Express app with a low-threshold dashboard rate limiter (2 req max)
      const testLimiterApp = express();
      testLimiterApp.use(express.json());
      const strictLimiter = createDashboardRateLimiter({ windowMs: 60000, max: 2 });
      testLimiterApp.get('/dashboard', strictLimiter, (_req, res) => {
        res.status(200).json({ success: true, data: 'dashboard' });
      });

      // Request 1: OK
      const res1 = await request(testLimiterApp).get('/dashboard');
      expect(res1.status).toBe(200);
      expect(res1.headers['ratelimit-remaining'] || res1.headers['x-ratelimit-remaining']).toBeDefined();

      // Request 2: OK
      const res2 = await request(testLimiterApp).get('/dashboard');
      expect(res2.status).toBe(200);

      // Request 3: Exceeded -> 429 TOO_MANY_REQUESTS
      const res3 = await request(testLimiterApp).get('/dashboard');
      expect(res3.status).toBe(429);
      expect(res3.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(res3.body.error.message).toContain('Too many dashboard requests');
    });
  });
});
