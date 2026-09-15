import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { Problem } from '../src/models/Problem.model.js';
import { ProblemSequence } from '../src/models/ProblemSequence.model.js';

describe('Problem Management API — Phase 3.1 (Dual Links, S.No., Privacy & CRUD)', () => {
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

  describe('1. Dual Problem Links & LeetCode Number Combinations', () => {
    it('should create a problem with only collegeLink', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Graph Traversal Lab',
          collegeLink: 'https://college.edu/lab/graphs',
          topic: 'Graphs',
          difficulty: 'Medium',
          source: 'Lab',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.problem.collegeLink).toBe('https://college.edu/lab/graphs');
      expect(res.body.data.problem.leetcodeLink).toBeNull();
      expect(res.body.data.problem.leetcodeNumber).toBeNull();
    });

    it('should create a problem with only leetcodeLink and leetcodeNumber', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Two Sum',
          leetcodeLink: 'https://leetcode.com/problems/two-sum',
          leetcodeNumber: 1,
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'LeetCode',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.problem.leetcodeLink).toBe('https://leetcode.com/problems/two-sum');
      expect(res.body.data.problem.leetcodeNumber).toBe(1);
      expect(res.body.data.problem.collegeLink).toBeNull();
    });

    it('should create a problem with BOTH collegeLink and leetcodeLink (single logical record)', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Binary Search in Lecture & LeetCode',
          collegeLink: 'https://college.edu/lecture/binary-search',
          leetcodeLink: 'https://leetcode.com/problems/binary-search',
          leetcodeNumber: 704,
          topic: 'Binary Search',
          difficulty: 'Easy',
          source: 'Lecture',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.problem.collegeLink).toBe('https://college.edu/lecture/binary-search');
      expect(res.body.data.problem.leetcodeLink).toBe('https://leetcode.com/problems/binary-search');
      expect(res.body.data.problem.leetcodeNumber).toBe(704);
    });

    it('should create a problem with NEITHER link', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Classroom Whiteboard Problem',
          topic: 'Strings',
          difficulty: 'Easy',
          source: 'Lecture',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.problem.collegeLink).toBeNull();
      expect(res.body.data.problem.leetcodeLink).toBeNull();
      expect(res.body.data.problem.title).toBe('Classroom Whiteboard Problem');
    });

    it('should reject invalid collegeLink URL format', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Invalid Link Problem',
          collegeLink: 'not-a-valid-url',
          topic: 'Trees',
          difficulty: 'Easy',
          source: 'Lecture',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid leetcodeLink URL format', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Invalid LC Link Problem',
          leetcodeLink: 'invalid-leetcode-url',
          topic: 'Trees',
          difficulty: 'Easy',
          source: 'LeetCode',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow independent updating of collegeLink, leetcodeLink, and leetcodeNumber', async () => {
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Mutable Links Problem',
          topic: 'Arrays',
          difficulty: 'Medium',
          source: 'Practice',
        });
      const problemId = createRes.body.data.problem.id;

      const updateRes = await request(app)
        .patch(`/api/v1/problems/${problemId}`)
        .set('Cookie', userACookie)
        .send({
          collegeLink: 'https://college.edu/updated-link',
          leetcodeLink: 'https://leetcode.com/problems/updated-link',
          leetcodeNumber: 15,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.problem.collegeLink).toBe('https://college.edu/updated-link');
      expect(updateRes.body.data.problem.leetcodeLink).toBe('https://leetcode.com/problems/updated-link');
      expect(updateRes.body.data.problem.leetcodeNumber).toBe(15);
    });
  });

  describe('2. S.No. Sequencing & Independent Numbering', () => {
    it('should assign sequential S.No. starting at 1 independently for College and Personal DSA', async () => {
      // User A creates College problem 1 & 2
      const c1 = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Binary Search Implementation',
          collegeLink: 'https://college.edu/dsa/lab1',
          topic: 'Binary Search',
          difficulty: 'Easy',
          source: 'Lab',
        });
      expect(c1.status).toBe(201);
      expect(c1.body.data.problem.sNo).toBe(1);

      const c2 = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'COLLEGE',
          title: 'Merge Sort Recursion',
          collegeLink: 'https://college.edu/dsa/lab2',
          topic: 'Recursion',
          difficulty: 'Medium',
          source: 'Lecture',
        });
      expect(c2.status).toBe(201);
      expect(c2.body.data.problem.sNo).toBe(2);

      // User A creates Personal problem 1 (Must start at 1, NOT 3)
      const p1 = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Two Sum',
          leetcodeLink: 'https://leetcode.com/problems/two-sum',
          leetcodeNumber: 1,
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'LeetCode',
        });
      expect(p1.status).toBe(201);
      expect(p1.body.data.problem.sNo).toBe(1);

      // User B creates College problem 1 (Must start at 1 independently from User A)
      const b_c1 = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userBCookie)
        .send({
          section: 'COLLEGE',
          title: 'User B Linked List',
          collegeLink: 'https://college.edu/b/lab1',
          topic: 'Linked List',
          difficulty: 'Easy',
          source: 'Lab',
        });
      expect(b_c1.status).toBe(201);
      expect(b_c1.body.data.problem.sNo).toBe(1);
    });

    it('should NOT renumber remaining problems on deletion and next created problem receives next S.No. (gaps preserved)', async () => {
      // User A creates 3 College problems: 1, 2, 3
      const p1 = await request(app).post('/api/v1/problems').set('Cookie', userACookie).send({
        section: 'COLLEGE',
        title: 'Problem 1',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'Lecture',
      });
      const p2 = await request(app).post('/api/v1/problems').set('Cookie', userACookie).send({
        section: 'COLLEGE',
        title: 'Problem 2',
        topic: 'Arrays',
        difficulty: 'Medium',
        source: 'Assignment',
      });
      const p3 = await request(app).post('/api/v1/problems').set('Cookie', userACookie).send({
        section: 'COLLEGE',
        title: 'Problem 3',
        topic: 'Arrays',
        difficulty: 'Hard',
        source: 'Exam',
      });

      expect(p1.body.data.problem.sNo).toBe(1);
      expect(p2.body.data.problem.sNo).toBe(2);
      expect(p3.body.data.problem.sNo).toBe(3);

      // Delete Problem #2
      const delRes = await request(app)
        .delete(`/api/v1/problems/${p2.body.data.problem.id}`)
        .set('Cookie', userACookie);
      expect(delRes.status).toBe(200);

      // Check listing: remaining problems must still have S.No 1 and 3 (no renumbering)
      const listRes = await request(app)
        .get('/api/v1/problems?section=COLLEGE')
        .set('Cookie', userACookie);
      const sNos = listRes.body.data.items.map((item: { sNo: number }) => item.sNo);
      expect(sNos).toEqual([1, 3]);

      // Create new Problem #4 -> must receive S.No 4 (does NOT reuse #2)
      const p4 = await request(app).post('/api/v1/problems').set('Cookie', userACookie).send({
        section: 'COLLEGE',
        title: 'Problem 4',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'Lab',
      });
      expect(p4.body.data.problem.sNo).toBe(4);
    });

    it('should assign unique non-colliding sequential S.No. even under concurrent creation requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/v1/problems')
          .set('Cookie', userACookie)
          .send({
            section: 'COLLEGE',
            title: `Concurrent Problem ${i + 1}`,
            topic: 'Concurrency',
            difficulty: 'Medium',
            source: 'Lab',
          })
      );

      const responses = await Promise.all(concurrentRequests);
      responses.forEach((res) => expect(res.status).toBe(201));

      const assignedSNos = responses.map((res) => res.body.data.problem.sNo).sort((a, b) => a - b);
      expect(assignedSNos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });

  describe('3. User Data Privacy & Complete Isolation', () => {
    it('User B cannot see, access by ID, update, or delete User A problem', async () => {
      // User A creates a problem
      const createRes = await request(app)
        .post('/api/v1/problems')
        .set('Cookie', userACookie)
        .send({
          section: 'PERSONAL',
          title: 'Private Problem of User A',
          leetcodeLink: 'https://leetcode.com/problems/private-a',
          topic: 'Dynamic Programming',
          difficulty: 'Hard',
          source: 'Personal',
        });
      const problemId = createRes.body.data.problem.id;

      // 1. User B lists problems -> User A problem is NOT visible
      const listB = await request(app)
        .get('/api/v1/problems?section=PERSONAL')
        .set('Cookie', userBCookie);
      expect(listB.body.data.items.length).toBe(0);

      // 2. User B tries GET by ID -> Returns safe 404 (does NOT leak existence)
      const getB = await request(app)
        .get(`/api/v1/problems/${problemId}`)
        .set('Cookie', userBCookie);
      expect(getB.status).toBe(404);
      expect(getB.body.success).toBe(false);
      expect(getB.body.error.code).toBe('NOT_FOUND');

      // 3. User B tries PATCH -> Returns safe 404
      const patchB = await request(app)
        .patch(`/api/v1/problems/${problemId}`)
        .set('Cookie', userBCookie)
        .send({ title: 'Hacked Title' });
      expect(patchB.status).toBe(404);

      // 4. User B tries DELETE -> Returns safe 404
      const deleteB = await request(app)
        .delete(`/api/v1/problems/${problemId}`)
        .set('Cookie', userBCookie);
      expect(deleteB.status).toBe(404);

      // 5. User A CAN access their own problem
      const getA = await request(app)
        .get(`/api/v1/problems/${problemId}`)
        .set('Cookie', userACookie);
      expect(getA.status).toBe(200);
      expect(getA.body.data.problem.title).toBe('Private Problem of User A');
    });
  });

  describe('4. Search, Filtering, Sorting & Pagination', () => {
    beforeEach(async () => {
      // Seed 5 problems for User A
      const problems = [
        {
          section: 'PERSONAL',
          title: 'Two Sum',
          leetcodeLink: 'https://leetcode.com/problems/two-sum',
          leetcodeNumber: 1,
          topic: 'Arrays',
          difficulty: 'Easy',
          source: 'LeetCode',
          status: 'Solved',
          retentionLevel: 'Strong',
        },
        {
          section: 'PERSONAL',
          title: '3Sum',
          leetcodeLink: 'https://leetcode.com/problems/3sum',
          leetcodeNumber: 15,
          topic: 'Arrays',
          difficulty: 'Medium',
          source: 'LeetCode',
          status: 'Attempted',
          retentionLevel: 'Learning',
        },
        {
          section: 'PERSONAL',
          title: 'LRU Cache',
          leetcodeLink: 'https://leetcode.com/problems/lru-cache',
          leetcodeNumber: 146,
          topic: 'Design',
          difficulty: 'Medium',
          source: 'Practice',
          status: 'Solved',
          retentionLevel: 'Familiar',
        },
        {
          section: 'PERSONAL',
          title: 'Median of Two Sorted Arrays',
          leetcodeLink: 'https://leetcode.com/problems/median-of-two-sorted-arrays',
          leetcodeNumber: 4,
          topic: 'Binary Search',
          difficulty: 'Hard',
          source: 'LeetCode',
          status: 'Not Started',
          retentionLevel: 'Learning',
        },
        {
          section: 'COLLEGE',
          title: 'College Lab Linked List',
          collegeLink: 'https://college.edu/lab3',
          topic: 'Linked List',
          difficulty: 'Easy',
          source: 'Lab',
          status: 'Solved',
          retentionLevel: 'Independent',
        },
      ];

      for (const p of problems) {
        await request(app).post('/api/v1/problems').set('Cookie', userACookie).send(p);
      }
    });

    it('should filter by section and difficulty', async () => {
      const res = await request(app)
        .get('/api/v1/problems?section=PERSONAL&difficulty=Medium')
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.items.map((i: { title: string }) => i.title)).toContain('3Sum');
      expect(res.body.data.items.map((i: { title: string }) => i.title)).toContain('LRU Cache');
    });

    it('should search by problem title or topic', async () => {
      const searchRes = await request(app)
        .get('/api/v1/problems?search=median')
        .set('Cookie', userACookie);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.items.length).toBe(1);
      expect(searchRes.body.data.items[0].title).toBe('Median of Two Sorted Arrays');
    });

    it('should paginate and sort correctly', async () => {
      const page1 = await request(app)
        .get('/api/v1/problems?section=PERSONAL&page=1&limit=2&sortBy=sNo&sortOrder=asc')
        .set('Cookie', userACookie);

      expect(page1.status).toBe(200);
      expect(page1.body.data.items.length).toBe(2);
      expect(page1.body.data.pagination.total).toBe(4);
      expect(page1.body.data.pagination.totalPages).toBe(2);
      expect(page1.body.data.items[0].sNo).toBe(1);
      expect(page1.body.data.items[1].sNo).toBe(2);
    });
  });
});
