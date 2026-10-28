import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Phase 2B — AI is optional.
 *
 * This file deliberately isolates `GEMINI_API_KEY` as unconfigured. It proves the deployment story:
 * the tracker boots and works normally, `/ai/status` reports `enabled: false`, and an AI
 * request fails with a safe 503 instead of crashing or calling a provider.
 */

vi.hoisted(() => {
  delete process.env.GEMINI_API_KEY;
});

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    env: {
      ...actual.env,
      GEMINI_API_KEY: undefined,
    },
  };
});

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { Problem } from '../src/models/Problem.model.js';
import { ProblemSequence } from '../src/models/ProblemSequence.model.js';

describe('AI assistance without a configured key', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();
  let cookie: string;
  let problemId: string;

  beforeAll(async () => {
    delete process.env.GEMINI_API_KEY;

    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    await Problem.deleteMany({});
    await ProblemSequence.deleteMany({});
    await User.deleteMany({});

    const registered = await request(app).post('/api/v1/auth/register').send({
      name: 'No Key Learner',
      email: 'no-key@example.com',
      password: 'Password123!',
    });
    cookie = registered.headers['set-cookie']![0]!;

    const created = await request(app)
      .post('/api/v1/problems')
      .set('Cookie', cookie)
      .send({
        section: 'PERSONAL',
        title: 'Climbing Stairs',
        topic: 'Dynamic Programming',
        difficulty: 'Easy',
        source: 'Personal',
      });

    problemId = created.body.data.problem.id as string;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('reports AI as disabled without exposing configuration', async () => {
    const res = await request(app).get('/api/v1/ai/status').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);
    expect(res.body.data.model).toBeNull();
  });

  it('returns a safe, actionable error instead of failing the request pipeline', async () => {
    const res = await request(app)
      .post(`/api/v1/ai/problems/${problemId}/generate`)
      .set('Cookie', cookie)
      .send({ feature: 'explain' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
    expect(res.body.error.message).toContain('remains fully usable');
  });

  it('leaves normal tracker endpoints untouched', async () => {
    const res = await request(app).get('/api/v1/problems').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });
});
