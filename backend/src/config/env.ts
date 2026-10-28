import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5001),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/dsa_tracker'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(process.env.NODE_ENV === 'test' ? 1000 : 20),

  // ------------------------------------------------------------------ Gemini AI
  // Optional on purpose: the tracker must run exactly as before when no key is set.
  // The key is read here only and is never serialised into a response.
  GEMINI_API_KEY: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(1).optional()
  ),
  /** Flash-class model id. Configurable so a provider/model change needs no code change. */
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.8-flash'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(2400),
  // Application-level protection only. These are NOT Google's quota numbers, which are
  // project-specific and change without notice.
  AI_USER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  AI_USER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(
    process.env.NODE_ENV === 'test' ? 1000 : 20
  ),
  AI_GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  AI_GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(
    process.env.NODE_ENV === 'test' ? 100000 : 150
  ),
  AI_CACHE_TTL_MS: z.coerce.number().int().positive().default(6 * 60 * 60 * 1000),
  AI_CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
