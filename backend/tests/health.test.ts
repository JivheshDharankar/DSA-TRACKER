import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Health Check API', () => {
  const app = createApp();

  it('GET /api/v1/health should return 200 OK and healthy status', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'DSA Tracker API is running');
    expect(response.body.data).toHaveProperty('status', 'healthy');
    expect(response.body.data).toHaveProperty('uptimeSeconds');
    expect(response.body.data).toHaveProperty('timestamp');
    expect(response.body.data).toHaveProperty('environment');
    expect(response.body.data).toHaveProperty('database');
  });

  it('GET /api/v1/non-existent-route should return 404 NOT_FOUND', async () => {
    const response = await request(app).get('/api/v1/non-existent-route');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
  });
});
