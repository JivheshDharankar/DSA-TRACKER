import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const createAuthRateLimiter = (options?: { windowMs?: number; max?: number }) => {
  return rateLimit({
    windowMs: options?.windowMs ?? env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: options?.max ?? env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true, // Return standard RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          message: 'Too many authentication attempts. Please try again later.',
          code: 'TOO_MANY_REQUESTS',
        },
      });
    },
  });
};

export const authRateLimiter = createAuthRateLimiter();

export const createDashboardRateLimiter = (options?: { windowMs?: number; max?: number }) => {
  return rateLimit({
    windowMs: options?.windowMs ?? 60 * 1000, // 1 minute window
    max: options?.max ?? (process.env.NODE_ENV === 'test' ? 1000 : 60), // 60 requests/minute in dev/prod, 1000 in test
    standardHeaders: true, // Return standard RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          message: 'Too many dashboard requests. Please try again later.',
          code: 'TOO_MANY_REQUESTS',
        },
      });
    },
  });
};

export const dashboardRateLimiter = createDashboardRateLimiter();

/**
 * LeetCode import limiter.
 * Import is the only endpoint that causes an outbound request, so it gets its own small
 * budget: 10 per minute per client in development/production, 1000 under test. This is
 * deliberately modest — it stops a stuck client or a script from hammering LeetCode, but
 * is not a general-purpose abuse system.
 */
export const createImportRateLimiter = (options?: { windowMs?: number; max?: number }) => {
  return rateLimit({
    windowMs: options?.windowMs ?? 60 * 1000,
    max: options?.max ?? (process.env.NODE_ENV === 'test' ? 1000 : 10),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          message: 'Too many import attempts. Please wait a moment and try again, or enter the details manually.',
          code: 'TOO_MANY_REQUESTS',
        },
      });
    },
  });
};

export const importRateLimiter = createImportRateLimiter();
