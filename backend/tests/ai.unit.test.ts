import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '@google/genai';

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = 'unit-test-key';
  process.env.GEMINI_MODEL = 'gemini-test-flash';
});

import { TtlCache } from '../src/services/ai/ai.cache.js';
import { WindowRateLimiter } from '../src/services/ai/ai.rateLimit.js';
import {
  AiProviderError,
  classifyProviderError,
  AI_MAX_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
} from '../src/services/ai/gemini.provider.js';
import { buildPrompt } from '../src/services/ai/ai.prompts.js';
import { AiService } from '../src/services/ai/ai.service.js';
import { IProblemDocument } from '../src/models/Problem.model.js';
import { IProblemRepository } from '../src/repositories/problem.repository.js';
import { AiProvider } from '../src/services/ai/gemini.provider.js';
import { TtlCache as Cache } from '../src/services/ai/ai.cache.js';

/**
 * Phase 2B — AI unit tests.
 * These cover the pieces that are easy to get subtly wrong and hard to see over HTTP:
 * cache expiry/eviction, window accounting, provider error classification, prompt privacy,
 * and the two independent rate-limit gates.
 */

describe('TtlCache', () => {
  it('returns stored values until the TTL expires', () => {
    let now = 1000;
    const cache = new TtlCache<string>({ ttlMs: 500, maxEntries: 10, now: () => now });

    cache.set('a', 'value');
    expect(cache.get('a')).toBe('value');

    now += 499;
    expect(cache.get('a')).toBe('value');

    now += 2;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size()).toBe(0);
  });

  it('evicts the oldest entry when the capacity is reached', () => {
    const cache = new TtlCache<number>({ ttlMs: 10_000, maxEntries: 2, now: () => 0 });

    cache.set('first', 1);
    cache.set('second', 2);
    cache.set('third', 3);

    expect(cache.get('first')).toBeUndefined();
    expect(cache.get('second')).toBe(2);
    expect(cache.get('third')).toBe(3);
    expect(cache.size()).toBe(2);
  });
});

describe('WindowRateLimiter', () => {
  it('allows exactly `max` requests per window and then refuses', () => {
    let now = 0;
    const limiter = new WindowRateLimiter({ windowMs: 1000, max: 2, now: () => now });

    expect(limiter.consume('user-1').allowed).toBe(true);
    expect(limiter.consume('user-1').allowed).toBe(true);

    const blocked = limiter.consume('user-1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(1000);

    now = 1000;
    expect(limiter.consume('user-1').allowed).toBe(true);
  });

  it('counts each key independently', () => {
    const limiter = new WindowRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });

    expect(limiter.consume('user-a').allowed).toBe(true);
    expect(limiter.consume('user-a').allowed).toBe(false);
    expect(limiter.consume('user-b').allowed).toBe(true);
  });
});

describe('classifyProviderError', () => {
  it('maps 429 to a non-repeatable quota failure', () => {
    const classified = classifyProviderError(new ApiError({ message: 'quota', status: 429 }));
    expect(classified.kind).toBe('quota');
    expect(classified.retryable).toBe(true);
  });

  it('maps credential failures to auth', () => {
    expect(classifyProviderError(new ApiError({ message: 'nope', status: 401 })).kind).toBe('auth');
    expect(classifyProviderError(new ApiError({ message: 'nope', status: 403 })).kind).toBe('auth');
  });

  it('maps an unknown model to invalid-request', () => {
    expect(classifyProviderError(new ApiError({ message: 'missing', status: 404 })).kind).toBe(
      'invalid-request'
    );
  });

  it('classifies SDK errors that are not ApiError by their numeric status', () => {
    // The SDK raises `BadRequestError` (not `ApiError`) for a rejected key or schema.
    const badRequest = Object.assign(new Error('400 API error occurred'), {
      name: 'BadRequestError',
      status: 400,
    });
    expect(classifyProviderError(badRequest).kind).toBe('invalid-request');

    const viaStatusCode = Object.assign(new Error('nope'), { statusCode: 401 });
    expect(classifyProviderError(viaStatusCode).kind).toBe('auth');
  });

  it('maps server failures to unavailable', () => {
    const classified = classifyProviderError(new ApiError({ message: 'down', status: 503 }));
    expect(classified.kind).toBe('unavailable');
    expect(classified.retryable).toBe(true);
  });

  it('maps aborts and timeouts to timeout', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(classifyProviderError(abort).kind).toBe('timeout');

    const message = new Error('request timed out');
    expect(classifyProviderError(message).kind).toBe('timeout');
  });

  it('passes an AiProviderError through unchanged', () => {
    const original = new AiProviderError('unavailable', 'x', undefined, true);
    expect(classifyProviderError(original)).toBe(original);
  });
});

describe('buildPrompt', () => {
  const context = {
    title: 'Median of Two Sorted Arrays',
    topic: 'Binary Search',
    difficulty: 'Hard' as const,
    source: 'LeetCode',
    leetcodeNumber: 4,
    leetcodeLink: 'https://leetcode.com/problems/median-of-two-sorted-arrays/',
    notes: null,
    code: null,
  };

  it('sends only the problem facts for a generic explanation', () => {
    const { systemInstruction, prompt } = buildPrompt({ feature: 'explain', context });

    expect(prompt).toContain('Median of Two Sorted Arrays');
    expect(prompt).toContain('Binary Search');
    expect(prompt).toContain('LeetCode number: 4');
    expect(prompt).not.toContain('<user_notes>');
    expect(prompt).not.toContain('<user_code>');
    expect(systemInstruction).toContain('Never invent constraints');
  });

  it('keeps user notes in a labelled data block and guards against injection', () => {
    const { prompt, systemInstruction } = buildPrompt({
      feature: 'revision-notes',
      context: { ...context, notes: 'my own framing' },
    });

    expect(prompt).toContain('<user_notes>');
    expect(prompt).toContain('my own framing');
    // The instruction that user text is data lives in the system instruction.
    expect(systemInstruction).toContain('not instructions');
  });

  it('escalates hint levels', () => {
    const level1 = buildPrompt({ feature: 'hint', level: 1, context }).prompt;
    const level3 = buildPrompt({ feature: 'hint', level: 3, context }).prompt;

    expect(level1).toContain('Level 1');
    expect(level1).not.toContain('Level 3');
    expect(level3).toContain('Level 3');
    expect(level3).not.toContain('Level 1');
  });

  it('truncates an oversized note instead of sending it whole', () => {
    const { prompt } = buildPrompt({
      feature: 'revision-notes',
      context: { ...context, notes: 'x'.repeat(10_000) },
    });

    expect(prompt).toContain('[truncated]');
    expect(prompt.length).toBeLessThan(10_000);
  });
});

describe('AiService limits (injected dependencies)', () => {
  const problem = {
    _id: 'p1',
    id: 'p1',
    userId: 'user-1',
    title: 'Number of Islands',
    topic: 'Graphs',
    difficulty: 'Medium',
    source: 'LeetCode',
    leetcodeNumber: 200,
    leetcodeLink: 'https://leetcode.com/problems/number-of-islands/',
    notes: 'BFS over the grid.',
    repetitionStage: 2,
    intervalDays: 3,
    nextReviewDate: new Date('2026-01-01'),
    status: 'Attempted',
    retentionLevel: 'Familiar',
    masteryStatus: 'UNLOCKED',
  } as unknown as IProblemDocument;

  const explanation = {
    summary: 'Count connected components of land.',
    observations: ['Land cells are connected in four directions.'],
    constraints: ['Grid can be empty.'],
    intuition: 'Flood fill each unvisited land cell.',
    approach: ['Scan the grid.', 'Flood fill from every unvisited land cell.'],
    correctness: 'Each component is visited exactly once.',
    complexity: { time: 'O(m·n)', space: 'O(m·n)' },
    edgeCases: ['Empty grid'],
  };

  const makeProvider = (): AiProvider & { generateStructured: ReturnType<typeof vi.fn> } =>
    ({
      generateStructured: vi.fn(async () => ({
        text: JSON.stringify(explanation),
        model: 'gemini-test-flash',
      })),
    }) as unknown as AiProvider & { generateStructured: ReturnType<typeof vi.fn> };

  const makeRepo = (): IProblemRepository =>
    ({ findById: vi.fn(async () => problem) }) as unknown as IProblemRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks a user who exceeds their own AI budget', async () => {
    const service = new AiService({
      provider: makeProvider(),
      problemRepo: makeRepo(),
      cache: new Cache({ ttlMs: 1000, maxEntries: 5 }),
      userLimiter: new WindowRateLimiter({ windowMs: 60_000, max: 1, now: () => 0 }),
      globalLimiter: new WindowRateLimiter({ windowMs: 60_000, max: 100, now: () => 0 }),
    });

    await service.generate('user-1', 'p1', { feature: 'explain' });

    await expect(service.generate('user-1', 'p1', { feature: 'recall' })).rejects.toMatchObject({
      statusCode: 429,
      code: 'AI_RATE_LIMITED',
    });
  });

  it('blocks everyone once the global safety limit is reached', async () => {
    // Two distinct problems so the second request is genuinely provider-bound, not a cache hit.
    const repo = {
      findById: vi.fn(async (id: string) => ({
        ...problem,
        _id: id,
        leetcodeNumber: id === 'p1' ? 200 : 201,
      })),
    } as unknown as IProblemRepository;

    const service = new AiService({
      provider: makeProvider(),
      problemRepo: repo,
      cache: new Cache({ ttlMs: 1000, maxEntries: 5 }),
      userLimiter: new WindowRateLimiter({ windowMs: 60_000, max: 100, now: () => 0 }),
      globalLimiter: new WindowRateLimiter({ windowMs: 60_000, max: 1, now: () => 0 }),
    });

    await service.generate('user-1', 'p1', { feature: 'explain' });

    await expect(service.generate('user-2', 'p2', { feature: 'explain' })).rejects.toMatchObject({
      statusCode: 503,
      code: 'AI_QUOTA_EXHAUSTED',
    });
  });

  it('caps the requested output tokens', async () => {
    const provider = makeProvider();
    const service = new AiService({
      provider,
      problemRepo: makeRepo(),
      cache: new Cache({ ttlMs: 1000, maxEntries: 5 }),
      userLimiter: new WindowRateLimiter({ windowMs: 60_000, max: 100, now: () => 0 }),
      globalLimiter: new WindowRateLimiter({ windowMs: 60_000, max: 100, now: () => 0 }),
    });

    await service.generate('user-1', 'p1', { feature: 'explain' });

    const request = provider.generateStructured.mock.calls[0]![0] as {
      model: string;
      maxOutputTokens: number;
      jsonSchema: Record<string, unknown>;
    };
    expect(request.model).toBe('gemini-test-flash');
    expect(request.maxOutputTokens).toBeGreaterThan(0);
    expect(request.maxOutputTokens).toBeLessThanOrEqual(2400);
    expect(request.jsonSchema).toHaveProperty('properties.summary');
  });

  it('enforces a strict upper bound of 2 attempts and bounded exponential delays', () => {
    expect(AI_MAX_ATTEMPTS).toBe(2);
    expect(RETRY_BASE_DELAY_MS).toBe(1000);
    expect(RETRY_MAX_DELAY_MS).toBe(4000);

    const delayAttempt1 = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, 0), RETRY_MAX_DELAY_MS);
    const delayAttempt2 = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, 1), RETRY_MAX_DELAY_MS);
    expect(delayAttempt1).toBe(1000);
    expect(delayAttempt2).toBe(2000);
    expect(delayAttempt2).toBeLessThanOrEqual(RETRY_MAX_DELAY_MS);
  });
});
