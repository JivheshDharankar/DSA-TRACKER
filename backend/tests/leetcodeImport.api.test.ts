import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { Problem } from '../src/models/Problem.model.js';

/**
 * Phase 2A — `POST /api/v1/problems/import/leetcode`, over HTTP.
 * The metadata provider is stubbed through a module mock, so these tests never touch the
 * network and never depend on LeetCode being reachable.
 */

const providerMock = vi.hoisted(() => ({ fetchProblemMetadata: vi.fn() }));

vi.mock('../src/services/leetcode/leetcodeMetadataProvider.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../src/services/leetcode/leetcodeMetadataProvider.js')
  >();
  return {
    ...actual,
    leetcodeMetadataProvider: {
      fetchProblemMetadata: providerMock.fetchProblemMetadata,
    },
  };
});

// Imported after the mock is registered (vi.mock is hoisted).
const { LeetCodeMetadataUnavailableError } = await import(
  '../src/services/leetcode/leetcodeMetadataProvider.js'
);

describe('POST /api/v1/problems/import/leetcode', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Problem.deleteMany({});
    providerMock.fetchProblemMetadata.mockReset();
  });

  const registerUser = async (email = 'importer@example.com') => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Import Tester',
      email,
      password: 'SuperSecurePassword123!',
    });
    return res.headers['set-cookie'] as unknown as string[];
  };

  const sampleProblem = {
    section: 'PERSONAL',
    title: 'Two Sum',
    topic: 'Arrays',
    difficulty: 'Easy',
    source: 'LeetCode',
    leetcodeLink: 'https://leetcode.com/problems/two-sum/',
  };

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/problems/import/leetcode')
      .send({ url: 'https://leetcode.com/problems/two-sum/' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(providerMock.fetchProblemMetadata).not.toHaveBeenCalled();
  });

  it('rejects a non-LeetCode URL with a safe 400', async () => {
    const cookie = await registerUser();

    const res = await request(app)
      .post('/api/v1/problems/import/leetcode')
      .set('Cookie', cookie)
      .send({ url: 'https://example.com/problems/two-sum/' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_LEETCODE_URL');
    expect(providerMock.fetchProblemMetadata).not.toHaveBeenCalled();
  });

  it('refuses to act as a URL fetcher for internal addresses', async () => {
    const cookie = await registerUser();

    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:5001/api/v1/health',
      'file:///etc/passwd',
      'https://leetcode.com.evil.example/problems/two-sum/',
    ]) {
      const res = await request(app)
        .post('/api/v1/problems/import/leetcode')
        .set('Cookie', cookie)
        .send({ url });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_LEETCODE_URL');
    }
    expect(providerMock.fetchProblemMetadata).not.toHaveBeenCalled();
  });

  it('rejects unexpected body keys', async () => {
    const cookie = await registerUser();

    const res = await request(app)
      .post('/api/v1/problems/import/leetcode')
      .set('Cookie', cookie)
      .send({ url: 'https://leetcode.com/problems/two-sum/', userId: 'someone-else' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns verified metadata for a valid URL', async () => {
    const cookie = await registerUser();
    providerMock.fetchProblemMetadata.mockResolvedValue({
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcodeNumber: 1,
    });

    const res = await request(app)
      .post('/api/v1/problems/import/leetcode')
      .set('Cookie', cookie)
      .send({ url: 'https://www.leetcode.com/problems/two-sum/?envType=daily#top' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      source: 'LeetCode',
      slug: 'two-sum',
      url: 'https://leetcode.com/problems/two-sum/',
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcodeNumber: 1,
      status: 'IMPORTED',
      duplicate: null,
    });
    // Only the normalised slug ever reaches the provider.
    expect(providerMock.fetchProblemMetadata).toHaveBeenCalledWith('two-sum');
  });

  it('returns status UNAVAILABLE (not an error) when retrieval is blocked', async () => {
    const cookie = await registerUser();
    providerMock.fetchProblemMetadata.mockRejectedValue(
      new LeetCodeMetadataUnavailableError('http_error')
    );

    const res = await request(app)
      .post('/api/v1/problems/import/leetcode')
      .set('Cookie', cookie)
      .send({ url: 'https://leetcode.com/problems/two-sum/' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'UNAVAILABLE',
      title: null,
      difficulty: null,
      suggestedTitle: 'Two Sum',
      url: 'https://leetcode.com/problems/two-sum/',
    });
    expect(res.body.data.message).toMatch(/manually/i);
    // No stack trace or upstream detail leaks to the client.
    expect(JSON.stringify(res.body)).not.toMatch(/http_error|stack|graphql/i);
  });

  it('reports an existing problem as a duplicate instead of silently re-creating it', async () => {
    const cookie = await registerUser();
    const created = await request(app)
      .post('/api/v1/problems')
      .set('Cookie', cookie)
      .send(sampleProblem);
    expect(created.status).toBe(201);

    providerMock.fetchProblemMetadata.mockResolvedValue({
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcodeNumber: 1,
    });

    const res = await request(app)
      .post('/api/v1/problems/import/leetcode')
      .set('Cookie', cookie)
      .send({ url: 'https://leetcode.com/problems/two-sum/description/' });

    expect(res.status).toBe(200);
    expect(res.body.data.duplicate).toMatchObject({
      id: created.body.data.problem.id,
      sNo: created.body.data.problem.sNo,
      title: 'Two Sum',
      section: 'PERSONAL',
    });
  });

  it('keeps the existing create flow working for imported values', async () => {
    const cookie = await registerUser();
    providerMock.fetchProblemMetadata.mockResolvedValue({
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcodeNumber: 1,
    });

    const preview = await request(app)
      .post('/api/v1/problems/import/leetcode')
      .set('Cookie', cookie)
      .send({ url: 'https://leetcode.com/problems/two-sum/' });

    const res = await request(app)
      .post('/api/v1/problems')
      .set('Cookie', cookie)
      .send({
        section: 'PERSONAL',
        title: preview.body.data.title,
        topic: 'Arrays',
        difficulty: preview.body.data.difficulty,
        source: preview.body.data.source,
        leetcodeLink: preview.body.data.url,
        leetcodeNumber: preview.body.data.leetcodeNumber,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.problem).toMatchObject({
      title: 'Two Sum',
      leetcodeLink: 'https://leetcode.com/problems/two-sum/',
      repetitionStage: 0,
      intervalDays: 0,
    });

    const list = await request(app)
      .get('/api/v1/problems?section=PERSONAL')
      .set('Cookie', cookie);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].title).toBe('Two Sum');
  });
});
