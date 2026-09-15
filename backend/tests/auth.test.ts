import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.model.js';
import { AUTH_COOKIE_NAME, parseDurationToMs, getAuthCookieOptions } from '../src/config/cookie.config.js';
import { env } from '../src/config/env.js';

describe('Authentication & Security API', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  const validUserData = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'SuperSecurePassword123!',
  };

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new user and set HTTP-only cookie', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validUserData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.name).toBe(validUserData.name);
      expect(response.body.data.user.email).toBe(validUserData.email.toLowerCase());
      expect(response.body.data.user.id).toBeDefined();

      // Ensure password and passwordHash are NEVER leaked
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.user.passwordHash).toBeUndefined();

      // Check HTTP-only cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies)).toBe(true);
      const authCookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      expect(authCookie).toBeDefined();
      expect(authCookie).toContain('HttpOnly');
    });

    it('should reject duplicate email registration with 409', async () => {
      await request(app).post('/api/v1/auth/register').send(validUserData);

      const duplicateResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(validUserData);

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.success).toBe(false);
      expect(duplicateResponse.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should reject registration when password is under 8 characters', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validUserData,
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration when email is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validUserData,
          email: 'not-an-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(validUserData);
    });

    it('should successfully log in with valid credentials and return HTTP-only cookie', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: validUserData.email,
          password: validUserData.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(validUserData.email);
      expect(response.body.data.user.passwordHash).toBeUndefined();

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const authCookie = cookies.find((c: string) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      expect(authCookie).toBeDefined();
      expect(authCookie).toContain('HttpOnly');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: validUserData.email,
          password: 'WrongPassword!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent email with same error message to avoid enumeration', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: validUserData.password,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/v1/auth/me & Security Hardening Tests', () => {
    it('should reject GET /api/v1/auth/me when token is missing (401)', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.data).toBeUndefined();
    });

    it('should reject GET /api/v1/auth/me with an invalid / malformed JWT string (401)', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `${AUTH_COOKIE_NAME}=invalid_malformed_token_payload`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
      expect(response.body.data).toBeUndefined();
    });

    it('should reject GET /api/v1/auth/me with a JWT signed with an unauthorized secret (401)', async () => {
      const fakeToken = jwt.sign({ userId: new mongoose.Types.ObjectId().toString() }, 'wrong_unauthorized_secret_key_123');

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `${AUTH_COOKIE_NAME}=${fakeToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
      expect(response.body.data).toBeUndefined();
    });

    it('should reject GET /api/v1/auth/me with an expired JWT token (401)', async () => {
      const expiredToken = jwt.sign(
        { userId: new mongoose.Types.ObjectId().toString() },
        env.JWT_SECRET,
        { expiresIn: '0s' }
      );

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `${AUTH_COOKIE_NAME}=${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
      expect(response.body.data).toBeUndefined();
    });

    it('should successfully return authenticated user profile when a valid cookie is present', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(validUserData);

      const cookie = registerRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.user.email).toBe(validUserData.email);
      expect(meRes.body.data.user.name).toBe(validUserData.name);
      expect(meRes.body.data.user.passwordHash).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear the authentication cookie and return success', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(validUserData);

      const cookie = registerRes.headers['set-cookie'];

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      const logoutCookie = logoutRes.headers['set-cookie']?.[0];
      expect(logoutCookie).toBeDefined();
      expect(logoutCookie).toMatch(/(Expires=Thu, 01 Jan 1970|Max-Age=0)/i);
    });
  });

  describe('Cookie & Expiration Synchronization', () => {
    it('should parse duration strings accurately to milliseconds', () => {
      expect(parseDurationToMs('30s')).toBe(30 * 1000);
      expect(parseDurationToMs('15m')).toBe(15 * 60 * 1000);
      expect(parseDurationToMs('24h')).toBe(24 * 60 * 60 * 1000);
      expect(parseDurationToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseDurationToMs('2w')).toBe(14 * 24 * 60 * 60 * 1000);
    });

    it('should configure auth cookie maxAge aligned with JWT_EXPIRES_IN', () => {
      const cookieOptions = getAuthCookieOptions();
      const expectedMs = parseDurationToMs(env.JWT_EXPIRES_IN);
      expect(cookieOptions.maxAge).toBe(expectedMs);
      expect(cookieOptions.httpOnly).toBe(true);
    });
  });
});
