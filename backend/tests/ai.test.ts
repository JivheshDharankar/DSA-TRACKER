import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Phase 2B — AI assistance over HTTP.
 *
 * The Gemini provider is replaced by a module mock, so these tests never touch the network
 * and never depend on a live API key or on Google's quota. The API key is injected with
 * `vi.hoisted` because `config/env.ts` parses `process.env` at import time.
 */

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GEMINI_MODEL = 'gemini-test-flash';
});

const providerMock = vi.hoisted(() => ({ generateStructured: vi.fn() }));

vi.mock('../src/services/ai/gemini.provider.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/ai/gemini.provider.js')>();
  return {
    ...actual,
    geminiProvider: { generateStructured: providerMock.generateStructured },
  };
});

const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/User.model.js');
const { Problem } = await import('../src/models/Problem.model.js');
const { ProblemSequence } = await import('../src/models/ProblemSequence.model.js');
const { AiProviderError } = await import('../src/services/ai/gemini.provider.js');
const { aiService } = await import('../src/services/ai/ai.service.js');

const EXPLANATION = {
  summary: 'Find two indices whose values add up to the target.',
  observations: ['Every value can be paired with exactly one complement.'],
  constraints: ['Exactly one valid answer exists.'],
  intuition: 'Store what you have already seen so the complement lookup is constant time.',
  approach: ['Walk the array once.', 'Check the map for the complement, then record the value.'],
  correctness: 'The invariant is that the map always holds every earlier element.',
  complexity: { time: 'O(n)', space: 'O(n)' },
  edgeCases: ['Duplicate values', 'Negative numbers'],
};

const HINT = {
  level: 1,
  title: 'What have you already seen?',
  hint: 'Before thinking about pairs, think about what information you wish you had at each index.',
  nextStep: 'Write down what a single pass would need to remember.',
};

const COMPLEXITY_RECOMMENDED = {
  subject: 'recommended-approach',
  time: 'O(n)',
  space: 'O(n)',
  reasoning: 'One pass with a hash map gives constant-time complement lookups.',
  bottlenecks: ['Hash map lookups', 'Single array traversal'],
  caveats: ['Assumes a hash map with amortised O(1) operations.'],
};

const COMPLEXITY_USER_CODE = { ...COMPLEXITY_RECOMMENDED, subject: 'user-code' };

const RECALL = {
  questions: [
    { question: 'Why does the map remove the need for a nested loop?', category: 'core-idea', answer: 'It answers the complement query in O(1).' },
    { question: 'Which pattern does this problem belong to?', category: 'pattern-recognition', answer: 'Hashing / complement lookup.' },
    { question: 'What invariant makes the single pass correct?', category: 'why-it-works', answer: 'The map contains every earlier element.' },
    { question: 'What breaks if duplicates are present?', category: 'edge-cases', answer: 'You must check the map before inserting.' },
    { question: 'What is the space complexity?', category: 'complexity', answer: 'O(n) for the map.' },
  ],
};

const REVISION_NOTES = {
  trigger: 'When asked to find a pair that sums to a target.',
  keyInsight: 'Trade space for time with a complement map.',
  algorithm: ['Create an empty map.', 'For each value, look for its complement.', 'Store the value.'],
  edgeCases: ['Duplicate values', 'Single element'],
  complexity: { time: 'O(n)', space: 'O(n)' },
  commonMistake: 'Inserting before checking, which matches an element with itself.',
  recallQuestion: 'Why is the map checked before insertion?',
};

const validPayloadFor = (feature: string, level = 1): unknown => {
  switch (feature) {
    case 'explain':
      return EXPLANATION;
    case 'hint':
      return { ...HINT, level };
    case 'complexity':
      return COMPLEXITY_RECOMMENDED;
    case 'recall':
      return RECALL;
    case 'revision-notes':
      return REVISION_NOTES;
    default:
      throw new Error(`Unknown feature ${feature}`);
  }
};

describe('AI assistance API', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let cookie: string;
  let otherCookie: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Problem.deleteMany({});
    await ProblemSequence.deleteMany({});
    await User.deleteMany({});
    providerMock.generateStructured.mockReset();
    aiService.invalidateCache();

    const alpha = await request(app).post('/api/v1/auth/register').send({
      name: 'Alpha Learner',
      email: 'ai-alpha@example.com',
      password: 'Password123!',
    });
    cookie = alpha.headers['set-cookie']![0]!;

    const beta = await request(app).post('/api/v1/auth/register').send({
      name: 'Beta Learner',
      email: 'ai-beta@example.com',
      password: 'Password123!',
    });
    otherCookie = beta.headers['set-cookie']![0]!;
  });

  const createProblem = async (
    overrides: Record<string, unknown> = {},
    asCookie: string = cookie
  ): Promise<Record<string, unknown>> => {
    const res = await request(app)
      .post('/api/v1/problems')
      .set('Cookie', asCookie)
      .send({
        section: 'PERSONAL',
        title: 'Two Sum',
        topic: 'Arrays',
        difficulty: 'Easy',
        source: 'Personal',
        leetcodeLink: 'https://leetcode.com/problems/two-sum/',
        leetcodeNumber: 1,
        ...overrides,
      });

    expect(res.status).toBe(201);
    return res.body.data.problem as Record<string, unknown>;
  };

  const generate = (
    problemId: string,
    body: Record<string, unknown>,
    asCookie: string = cookie
  ) => request(app).post(`/api/v1/ai/problems/${problemId}/generate`).set('Cookie', asCookie).send(body);

  // ------------------------------------------------------------------ basics

  it('exposes AI status to an authenticated user without leaking the key', async () => {
    const res = await request(app).get('/api/v1/ai/status').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.model).toBe('gemini-test-flash');
    expect(JSON.stringify(res.body)).not.toContain('test-gemini-key');
  });

  it('rejects unauthenticated requests', async () => {
    const statusRes = await request(app).get('/api/v1/ai/status');
    expect(statusRes.status).toBe(401);
    expect(statusRes.body.success).toBe(false);

    const problem = await createProblem();
    const res = await request(app)
      .post(`/api/v1/ai/problems/${problem.id as string}/generate`)
      .send({ feature: 'explain' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(providerMock.generateStructured).not.toHaveBeenCalled();
  });

  it('rejects an unsupported feature', async () => {
    const problem = await createProblem();
    const res = await generate(problem.id as string, { feature: 'write-my-thesis' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(providerMock.generateStructured).not.toHaveBeenCalled();
  });

  it('rejects extra context that the feature does not need', async () => {
    const problem = await createProblem();

    const withCode = await generate(problem.id as string, { feature: 'explain', code: 'print(1)' });
    expect(withCode.status).toBe(400);

    const withLevel = await generate(problem.id as string, { feature: 'recall', level: 2 });
    expect(withLevel.status).toBe(400);

    const unknownField = await generate(problem.id as string, { feature: 'explain', userId: 'x' });
    expect(unknownField.status).toBe(400);
    expect(providerMock.generateStructured).not.toHaveBeenCalled();
  });

  it('rejects an unknown problem and another user’s problem with the same 404', async () => {
    const problem = await createProblem();

    const missing = await generate(new mongoose.Types.ObjectId().toString(), { feature: 'explain' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    const foreign = await generate(problem.id as string, { feature: 'explain' }, otherCookie);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');
    expect(providerMock.generateStructured).not.toHaveBeenCalled();
  });

  it('handles a malformed problem id without a cast error', async () => {
    const res = await generate('not-an-object-id', { feature: 'explain' });
    expect(res.status).toBe(404);
    expect(providerMock.generateStructured).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------- generation

  it.each(['explain', 'hint', 'recall', 'revision-notes'] as const)(
    'returns validated %s content on provider success',
    async (feature) => {
      const problem = await createProblem();
      providerMock.generateStructured.mockResolvedValue({
        text: JSON.stringify(validPayloadFor(feature)),
        model: 'gemini-test-flash',
      });

      const res = await generate(problem.id as string, { feature });

      expect(res.status).toBe(200);
      expect(res.body.data.feature).toBe(feature);
      expect(res.body.data.cached).toBe(false);
      expect(res.body.data.content).toMatchObject(
        validPayloadFor(feature) as Record<string, unknown>
      );
      expect(res.body.data.meta.promptVersion).toEqual(expect.any(String));
    }
  );

  it('analyses the user’s own code when code is supplied', async () => {
    const problem = await createProblem();
    providerMock.generateStructured.mockResolvedValue({
      text: JSON.stringify(COMPLEXITY_USER_CODE),
      model: 'gemini-test-flash',
    });

    const res = await generate(problem.id as string, {
      feature: 'complexity',
      code: 'function twoSum(nums, target) { return nums.map(() => 0); }',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.content.subject).toBe('user-code');

    const request0 = providerMock.generateStructured.mock.calls[0]![0] as {
      prompt: string;
      model: string;
    };
    expect(request0.prompt).toContain('<user_code>');
    expect(request0.prompt).toContain('function twoSum');
    expect(request0.model).toBe('gemini-test-flash');
  });

  it('returns a safe error when the provider times out', async () => {
    const problem = await createProblem();
    providerMock.generateStructured.mockRejectedValue(
      new AiProviderError('timeout', 'request timed out', undefined, false)
    );

    const res = await generate(problem.id as string, { feature: 'explain' });

    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('AI_TIMEOUT');
    expect(res.body.error.message).not.toMatch(/gemini|api key/i);
  });

  it('returns the graceful quota message on 429 and never retries into a paid model', async () => {
    const problem = await createProblem();
    providerMock.generateStructured.mockRejectedValue(
      new AiProviderError('quota', '429 RESOURCE_EXHAUSTED', 429, false)
    );

    const res = await generate(problem.id as string, { feature: 'explain' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_QUOTA_EXHAUSTED');
    expect(res.body.error.message).toContain('shared AI quota');
    expect(res.body.error.message).toContain('remains fully usable');
    // One attempt, one model, no silent downgrade.
    expect(providerMock.generateStructured).toHaveBeenCalledTimes(1);
    const call = providerMock.generateStructured.mock.calls[0]![0] as { model: string };
    expect(call.model).toBe('gemini-test-flash');
  });

  it('sanitizes provider auth and configuration errors without leaking raw credentials or keys', async () => {
    const problem = await createProblem();
    providerMock.generateStructured.mockRejectedValue(
      new AiProviderError('auth', 'API_KEY_INVALID: secret_12345 rejected', 400, false)
    );

    const res = await generate(problem.id as string, { feature: 'explain' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_AUTH_ERROR');
    expect(res.body.error.message).toContain('server’s Gemini credentials were rejected');
    expect(JSON.stringify(res.body)).not.toContain('secret_12345');
    expect(JSON.stringify(res.body)).not.toContain('API_KEY_INVALID');
  });

  it('returns 429 with Retry-After header when user AI rate limit is exceeded', async () => {
    const problem = await createProblem();
    const limiterSpy = vi.spyOn(
      (aiService as unknown as { userLimiter: { consume: (k: string) => unknown } }).userLimiter,
      'consume'
    ).mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterMs: 30000,
    });

    const res = await generate(problem.id as string, { feature: 'explain' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('AI_RATE_LIMITED');
    expect(res.headers['retry-after']).toBe('30');
    expect(providerMock.generateStructured).not.toHaveBeenCalled();

    limiterSpy.mockRestore();
  });

  it('repairs malformed provider output once', async () => {
    const problem = await createProblem();
    providerMock.generateStructured
      .mockResolvedValueOnce({ text: 'Sure! Here is your explanation: ...', model: 'gemini-test-flash' })
      .mockResolvedValueOnce({
        text: JSON.stringify(EXPLANATION),
        model: 'gemini-test-flash',
      });

    const res = await generate(problem.id as string, { feature: 'explain' });

    expect(res.status).toBe(200);
    expect(providerMock.generateStructured).toHaveBeenCalledTimes(2);
    const repair = providerMock.generateStructured.mock.calls[1]![0] as { prompt: string };
    expect(repair.prompt).toContain('did not match the required JSON schema');
  });

  it('does not return unvalidated output twice in a row', async () => {
    const problem = await createProblem();
    providerMock.generateStructured.mockResolvedValue({
      text: JSON.stringify({ summary: 'too short a shape' }),
      model: 'gemini-test-flash',
    });

    const res = await generate(problem.id as string, { feature: 'explain' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_INVALID_RESPONSE');
    expect(providerMock.generateStructured).toHaveBeenCalledTimes(2);
  });

  it('rejects a hint that leaks a full solution as a code block', async () => {
    const problem = await createProblem();
    providerMock.generateStructured
      .mockResolvedValueOnce({
        text: JSON.stringify({ ...HINT, hint: 'Use this:\n```js\nreturn map;\n```' }),
        model: 'gemini-test-flash',
      })
      .mockResolvedValueOnce({ text: JSON.stringify(HINT), model: 'gemini-test-flash' });

    const res = await generate(problem.id as string, { feature: 'hint', level: 1 });

    expect(res.status).toBe(200);
    expect(providerMock.generateStructured).toHaveBeenCalledTimes(2);
  });

  it('rejects a hint that ignores the requested level', async () => {
    const problem = await createProblem();
    providerMock.generateStructured
      .mockResolvedValueOnce({ text: JSON.stringify({ ...HINT, level: 3 }), model: 'gemini-test-flash' })
      .mockResolvedValueOnce({ text: JSON.stringify(HINT), model: 'gemini-test-flash' });

    const res = await generate(problem.id as string, { feature: 'hint', level: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.content.level).toBe(1);
    expect(res.body.data.meta.level).toBe(1);
  });

  // --------------------------------------------------------------- integrity

  it('never modifies SRS, mastery, status or the user’s notes', async () => {
    const problem = await createProblem({ notes: 'My own approach: brute force first.' });
    providerMock.generateStructured.mockResolvedValue({
      text: JSON.stringify(REVISION_NOTES),
      model: 'gemini-test-flash',
    });

    await generate(problem.id as string, { feature: 'revision-notes' });

    const stored = await Problem.findById(problem.id).lean();
    expect(stored).not.toBeNull();
    expect(stored!.repetitionStage).toBe(0);
    expect(stored!.intervalDays).toBe(0);
    expect(stored!.nextReviewDate.toISOString()).toBe(problem.nextReviewDate as string);
    expect(stored!.status).toBe('Not Started');
    expect(stored!.masteryStatus).toBe('UNLOCKED');
    expect(stored!.retentionLevel).toBe('Learning');
    expect(stored!.notes).toBe('My own approach: brute force first.');
    expect(stored!.updatedAt.toISOString()).toBe(problem.updatedAt as string);
  });

  it('allows saving notes via problem update but strictly prevents tampering with SRS/mastery fields', async () => {
    const problem = await createProblem({ notes: 'Original note' });

    // 1. Legitimate update saving revision notes
    const validUpdate = await request(app)
      .patch(`/api/v1/problems/${problem.id}`)
      .set('Cookie', cookie)
      .send({ notes: 'Original note\n\n--- AI revision notes ---\nNew note' });

    expect(validUpdate.status).toBe(200);
    expect(validUpdate.body.data.problem.notes).toContain('AI revision notes');

    // 2. Attempting to tamper with mastery or SRS stage during note update is rejected
    const tamperedUpdate = await request(app)
      .patch(`/api/v1/problems/${problem.id}`)
      .set('Cookie', cookie)
      .send({
        notes: 'Trying to sneak mastery change',
        masteryStatus: 'LOCKED',
        repetitionStage: 5,
      });

    expect(tamperedUpdate.status).toBe(400);

    // Verify stored problem in DB: notes were updated by legitimate call, but SRS/mastery remained untouched
    const stored = await Problem.findById(problem.id).lean();
    expect(stored!.repetitionStage).toBe(0);
    expect(stored!.masteryStatus).toBe('UNLOCKED');
    expect(stored!.notes).toContain('AI revision notes');
  });

  it('serves a repeat request from cache without touching the provider', async () => {
    const problem = await createProblem();
    providerMock.generateStructured.mockResolvedValue({
      text: JSON.stringify(EXPLANATION),
      model: 'gemini-test-flash',
    });

    const first = await generate(problem.id as string, { feature: 'explain' });
    const second = await generate(problem.id as string, { feature: 'explain' });

    expect(first.status).toBe(200);
    expect(first.body.data.cached).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.data.cached).toBe(true);
    expect(providerMock.generateStructured).toHaveBeenCalledTimes(1);
  });

  it('never shares user-specific code analysis between users', async () => {
    const mine = await createProblem({ notes: 'SECRET-NOTE-AAA' });
    const theirs = await createProblem(
      { title: 'Two Sum', notes: 'SECRET-NOTE-BBB' },
      otherCookie
    );

    providerMock.generateStructured.mockResolvedValue({
      text: JSON.stringify(REVISION_NOTES),
      model: 'gemini-test-flash',
    });

    const first = await generate(mine.id as string, { feature: 'revision-notes' });
    const second = await generate(theirs.id as string, { feature: 'revision-notes' }, otherCookie);

    expect(first.body.data.cached).toBe(false);
    expect(second.body.data.cached).toBe(false);
    expect(providerMock.generateStructured).toHaveBeenCalledTimes(2);

    const prompts = providerMock.generateStructured.mock.calls.map(
      (call) => (call[0] as { prompt: string }).prompt
    );
    expect(prompts[0]).toContain('SECRET-NOTE-AAA');
    expect(prompts[0]).not.toContain('SECRET-NOTE-BBB');
    expect(prompts[1]).toContain('SECRET-NOTE-BBB');
    expect(prompts[1]).not.toContain('SECRET-NOTE-AAA');
  });

  it('may share a generic explanation of the same public LeetCode problem', async () => {
    const mine = await createProblem({ source: 'LeetCode' });
    const theirs = await createProblem({ source: 'LeetCode' }, otherCookie);

    providerMock.generateStructured.mockResolvedValue({
      text: JSON.stringify(EXPLANATION),
      model: 'gemini-test-flash',
    });

    await generate(mine.id as string, { feature: 'explain' });
    const second = await generate(theirs.id as string, { feature: 'explain' }, otherCookie);

    expect(second.body.data.cached).toBe(true);
    expect(providerMock.generateStructured).toHaveBeenCalledTimes(1);
  });

  it('does not send private notes with a generic explanation', async () => {
    const problem = await createProblem({ notes: 'PRIVATE-NOTE-XYZ' });
    providerMock.generateStructured.mockResolvedValue({
      text: JSON.stringify(EXPLANATION),
      model: 'gemini-test-flash',
    });

    await generate(problem.id as string, { feature: 'explain' });

    const prompt = (providerMock.generateStructured.mock.calls[0]![0] as { prompt: string }).prompt;
    expect(prompt).not.toContain('PRIVATE-NOTE-XYZ');
    expect(prompt).not.toContain('ai-alpha@example.com');
    expect(prompt).not.toContain('Alpha Learner');
  });

  it('ensures cached AI responses cannot bypass problem ownership', async () => {
    const problem = await createProblem({ source: 'LeetCode' });
    providerMock.generateStructured.mockResolvedValue({
      text: JSON.stringify(EXPLANATION),
      model: 'gemini-test-flash',
    });

    // User A generates explanation (now cached)
    const first = await generate(problem.id as string, { feature: 'explain' });
    expect(first.status).toBe(200);

    // User B attempts to access it using User A's problemId -> must be rejected with 404
    const foreign = await generate(problem.id as string, { feature: 'explain' }, otherCookie);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');
  });

  it('ensures User B cannot read User A’s private notes or review history', async () => {
    const problem = await createProblem({ notes: 'TOP-SECRET-ALGORITHM-NOTES' });

    // User B attempts to GET problem by ID
    const getRes = await request(app)
      .get(`/api/v1/problems/${problem.id as string}`)
      .set('Cookie', otherCookie);
    expect(getRes.status).toBe(404);
    expect(JSON.stringify(getRes.body)).not.toContain('TOP-SECRET-ALGORITHM-NOTES');

    // User B attempts to GET problem review history
    const historyRes = await request(app)
      .get(`/api/v1/reviews/problem/${problem.id as string}`)
      .set('Cookie', otherCookie);
    expect(historyRes.status).toBe(404);
  });
});
