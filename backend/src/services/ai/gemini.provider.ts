import { ApiError, GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';

/**
 * DSA Tracker — AI assistance (Phase 2B)
 * =====================================
 * Gemini provider.
 *
 * This is the only file that knows Google exists. Everything above it talks to
 * `AiProvider`, so replacing the provider later means implementing one interface.
 *
 * API surface: the official `@google/genai` SDK, using the Interactions API
 * (`client.interactions.create`), which is Google's current interface for new
 * JavaScript/TypeScript projects. Structured output is requested with
 * `response_format: [{ type: 'text', mime_type: 'application/json', schema }]`, so the
 * model is constrained to the schema instead of being asked to "answer in JSON".
 *
 * Cost and reliability rules:
 *   - the model id comes from `GEMINI_MODEL`; nothing is hardcoded per call site;
 *   - the SDK's own retries are disabled (`attempts: 1`) so the single bounded retry in
 *     this file is the only one — no infinite retry, no silent model downgrade;
 *   - `store: false` keeps the interaction out of Google's interaction store.
 */

export type AiProviderFailureKind =
  | 'quota'
  | 'timeout'
  | 'unavailable'
  | 'auth'
  | 'invalid-request'
  | 'unknown';

export class AiProviderError extends Error {
  constructor(
    public readonly kind: AiProviderFailureKind,
    message: string,
    public readonly status?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export interface StructuredGenerationRequest {
  model: string;
  systemInstruction: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  timeoutMs?: number;
}

export interface StructuredGenerationResult {
  text: string;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AiProvider {
  generateStructured(request: StructuredGenerationRequest): Promise<StructuredGenerationResult>;
}

/** Bounded retry policy: one retry is enough for a transient 429/5xx, and never enough to burn a quota. */
export const AI_MAX_ATTEMPTS = 2;
export const RETRY_BASE_DELAY_MS = 1000;
export const RETRY_MAX_DELAY_MS = 4000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Errors from the SDK are not all `ApiError`: a rejected key or an invalid schema arrives as
 * a `BadRequestError` carrying a numeric `status`. Reading `status`/`statusCode` structurally
 * keeps the mapping correct across SDK error classes (and across SDK versions).
 */
const statusOf = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  for (const candidate of [record['status'], record['statusCode']]) {
    if (typeof candidate === 'number' && candidate >= 100 && candidate < 600) {
      return candidate;
    }
  }

  return undefined;
};

/**
 * Maps a transport/SDK error onto the small set of failures the UI can act on.
 * Exported for unit testing: classification is the part most likely to rot as the SDK moves.
 */
export const classifyProviderError = (error: unknown): AiProviderError => {
  if (error instanceof AiProviderError) {
    return error;
  }

  const status = statusOf(error) ?? (error instanceof ApiError ? error.status : undefined);

  if (status !== undefined) {
    if (status === 429) {
      // Google's 429 covers per-minute, per-token and per-day limits. The backend cannot
      // tell them apart, so it never retries more than once and never upgrades to a paid tier.
      return new AiProviderError('quota', messageOf(error), status, true);
    }
    if (status === 401 || status === 403) {
      return new AiProviderError('auth', messageOf(error), status, false);
    }
    if (status === 404) {
      return new AiProviderError('invalid-request', messageOf(error), status, false);
    }
    if (status === 400 || status === 422) {
      return new AiProviderError('invalid-request', messageOf(error), status, false);
    }
    if (status >= 500) {
      return new AiProviderError('unavailable', messageOf(error), status, true);
    }

    return new AiProviderError('unknown', messageOf(error), status, false);
  }

  const name = error instanceof Error ? error.name : '';
  const message = messageOf(error);

  if (name === 'AbortError' || name === 'TimeoutError' || /timed?\s?out|etimedout/i.test(message)) {
    return new AiProviderError('timeout', message, undefined, true);
  }

  if (/fetch failed|econnreset|enotfound|eai_again|socket hang up/i.test(message)) {
    return new AiProviderError('unavailable', message, undefined, true);
  }

  return new AiProviderError('unknown', message, undefined, false);
};

let cachedClient: { apiKey: string; timeoutMs: number; client: GoogleGenAI } | null = null;

const getClient = (apiKey: string, timeoutMs: number): GoogleGenAI => {
  if (cachedClient && cachedClient.apiKey === apiKey && cachedClient.timeoutMs === timeoutMs) {
    return cachedClient.client;
  }

  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: timeoutMs,
      // No SDK-level retries: the bounded loop below is the single retry policy, so
      // tests and production behave identically.
      retryOptions: { attempts: 1 },
    },
  });

  cachedClient = { apiKey, timeoutMs, client };
  return client;
};

/** Test seam: forget the memoised SDK client (used when the key/timeout changes). */
export const resetGeminiClient = (): void => {
  cachedClient = null;
};

class GeminiProvider implements AiProvider {
  async generateStructured(
    request: StructuredGenerationRequest
  ): Promise<StructuredGenerationResult> {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      // The service checks this first; this guard exists so the provider can never be
      // called with an absent key and produce an ambiguous failure.
      throw new AiProviderError('auth', 'Gemini API key is not configured.', undefined, false);
    }

    const timeoutMs = request.timeoutMs ?? env.AI_REQUEST_TIMEOUT_MS;
    const client = getClient(apiKey, timeoutMs);

    let lastError: AiProviderError | null = null;

    for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt += 1) {
      try {
        const interaction = await client.interactions.create({
          model: request.model,
          input: request.prompt,
          system_instruction: request.systemInstruction,
          response_format: [
            {
              type: 'text',
              mime_type: 'application/json',
              schema: request.jsonSchema,
            },
          ],
          generation_config: {
            max_output_tokens: Math.min(request.maxOutputTokens, env.AI_MAX_OUTPUT_TOKENS),
          },
          store: false,
        });

        const text = interaction.output_text;
        if (!text || !text.trim()) {
          throw new AiProviderError(
            'unavailable',
            'The AI provider returned an empty response.',
            undefined,
            false
          );
        }

        return {
          text,
          model: request.model,
          usage: {
            inputTokens: interaction.usage?.total_input_tokens,
            outputTokens: interaction.usage?.total_output_tokens,
          },
        };
      } catch (error) {
        const classified = classifyProviderError(error);
        lastError = classified;

        // Never log the prompt or the response: it may contain the user's private notes.
        console.warn(
          `[ai] provider attempt ${attempt}/${AI_MAX_ATTEMPTS} failed: ${classified.kind}` +
            (classified.status ? ` (HTTP ${classified.status})` : '')
        );

        if (!classified.retryable || attempt === AI_MAX_ATTEMPTS) {
          throw classified;
        }

        const exponentialDelay = Math.min(
          RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1),
          RETRY_MAX_DELAY_MS
        );
        const jitter = Math.floor(Math.random() * 250);
        await sleep(exponentialDelay + jitter);
      }
    }

    throw lastError ?? new AiProviderError('unknown', 'AI provider request failed.', undefined, false);
  }
}

export const geminiProvider: AiProvider = new GeminiProvider();
