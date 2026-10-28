import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error.middleware.js';
import { problemRepository, IProblemRepository } from '../../repositories/problem.repository.js';
import { IProblemDocument } from '../../models/Problem.model.js';
import {
  AI_FEATURE_DEFINITIONS,
  AiFeature,
  AiFeatureContent,
  HintLevel,
} from './ai.schemas.js';
import { AI_PROMPT_VERSION, AiProblemContext, buildPrompt, buildRepairPrompt } from './ai.prompts.js';
import {
  AiProvider,
  AiProviderError,
  geminiProvider,
} from './gemini.provider.js';
import { AiCache, TtlCache } from './ai.cache.js';
import { WindowRateLimiter } from './ai.rateLimit.js';

/**
 * DSA Tracker — AI assistance (Phase 2B)
 * =====================================
 * AI orchestration.
 *
 * Pipeline: controller → this service → `AiProvider` (Gemini) → Google GenAI SDK.
 *
 * Responsibilities, in order:
 *   1. configuration guard — no key means a clean 503, never a crash;
 *   2. ownership — the problem must belong to the authenticated user;
 *   3. minimal context — public facts, plus private notes/code only for the two features
 *      that need them;
 *   4. cache — identical repeat requests skip the provider entirely;
 *   5. rate limits — per user first, then the global safety net;
 *   6. generation — one bounded repair retry if the output does not validate;
 *   7. validation — Zod is authoritative; unvalidated model output never leaves the server.
 *
 * The service never writes to the database. Mastery, SRS state, status, difficulty and
 * review scheduling are outside its reach: it only reads a problem and returns text.
 */

export interface AiGenerationInput {
  feature: AiFeature;
  level?: HintLevel;
  /** The user's own code, only meaningful for `complexity`. */
  code?: string;
}

export interface AiGenerationResult {
  feature: AiFeature;
  model: string;
  cached: boolean;
  content: AiFeatureContent;
  meta: {
    promptVersion: string;
    generatedAt: string;
    /** Present for `hint`. */
    level?: HintLevel;
  };
}

export interface AiStatusResult {
  enabled: boolean;
  model: string | null;
  features: AiFeature[];
}

interface CachedGeneration {
  content: AiFeatureContent;
  model: string;
  generatedAt: string;
}

interface AiServiceDeps {
  provider: AiProvider;
  cache: AiCache<CachedGeneration>;
  userLimiter: WindowRateLimiter;
  globalLimiter: WindowRateLimiter;
  problemRepo: IProblemRepository;
}

const hash = (value: unknown): string =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

const isConfigured = (): boolean => Boolean(env.GEMINI_API_KEY);

/**
 * A problem counts as publicly identifiable when it was imported from LeetCode and carries
 * a LeetCode identity. Only then may an explanation be shared between users who happen to
 * track the same problem.
 */
const isPublicProblem = (problem: IProblemDocument): boolean =>
  problem.source === 'LeetCode' &&
  (problem.leetcodeNumber != null || Boolean(problem.leetcodeLink));

const buildContext = (
  problem: IProblemDocument,
  feature: AiFeature,
  code?: string
): AiProblemContext => {
  const definition = AI_FEATURE_DEFINITIONS[feature];

  return {
    title: problem.title,
    topic: problem.topic,
    difficulty: problem.difficulty,
    source: problem.source,
    leetcodeNumber: problem.leetcodeNumber ?? null,
    leetcodeLink: problem.leetcodeLink ?? null,
    // Private context is included only where the feature genuinely needs it.
    notes: definition.usesPrivateContext ? problem.notes?.trim() || null : null,
    code: feature === 'complexity' ? code?.trim() || null : null,
  };
};

const stripCodeFences = (raw: string): string => {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
};

const issuesToString = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');

/** Feature-specific checks that a JSON schema cannot express. */
const semanticIssues = (
  feature: AiFeature,
  content: AiFeatureContent,
  requestedLevel: HintLevel,
  hadCode: boolean
): string | null => {
  if (feature === 'hint') {
    const hint = content as { level: number; hint: string };
    if (hint.level !== requestedLevel) {
      return `level: expected ${requestedLevel}, received ${hint.level}`;
    }
    // A hint that contains a code block has stopped being a hint.
    if (/```/.test(hint.hint)) {
      return 'hint: must not contain a code block';
    }
  }

  if (feature === 'complexity') {
    const complexity = content as { subject: string };
    const expected = hadCode ? 'user-code' : 'recommended-approach';
    if (complexity.subject !== expected) {
      return `subject: expected ${expected}, received ${complexity.subject}`;
    }
  }

  return null;
};

const mapProviderError = (error: AiProviderError): AppError => {
  switch (error.kind) {
    case 'quota':
      return new AppError(
        'AI assistance is temporarily unavailable because the shared AI quota has been reached. Your DSA Tracker remains fully usable.',
        503,
        'AI_QUOTA_EXHAUSTED'
      );
    case 'timeout':
      return new AppError(
        'The AI service took too long to respond. Please try again.',
        504,
        'AI_TIMEOUT'
      );
    case 'auth':
      return new AppError(
        'AI assistance is unavailable because the server’s Gemini credentials were rejected.',
        503,
        'AI_AUTH_ERROR'
      );
    case 'invalid-request':
      return new AppError(
        'AI assistance is unavailable because the server’s Gemini credentials or model configuration was rejected.',
        503,
        'AI_CONFIGURATION_ERROR'
      );
    case 'unavailable':
      return new AppError(
        'AI assistance is temporarily unavailable. Your DSA Tracker remains fully usable.',
        503,
        'AI_UNAVAILABLE'
      );
    default:
      return new AppError(
        'AI assistance failed unexpectedly. Please try again.',
        502,
        'AI_UNAVAILABLE'
      );
  }
};

export class AiService {
  private readonly provider: AiProvider;
  private readonly cache: AiCache<CachedGeneration>;
  private readonly userLimiter: WindowRateLimiter;
  private readonly globalLimiter: WindowRateLimiter;
  private readonly problemRepo: IProblemRepository;

  constructor(deps: Partial<AiServiceDeps> = {}) {
    this.provider = deps.provider ?? geminiProvider;
    this.cache =
      deps.cache ??
      new TtlCache<CachedGeneration>({
        ttlMs: env.AI_CACHE_TTL_MS,
        maxEntries: env.AI_CACHE_MAX_ENTRIES,
      });
    this.userLimiter =
      deps.userLimiter ??
      new WindowRateLimiter({
        windowMs: env.AI_USER_RATE_LIMIT_WINDOW_MS,
        max: env.AI_USER_RATE_LIMIT_MAX,
      });
    this.globalLimiter =
      deps.globalLimiter ??
      new WindowRateLimiter({
        windowMs: env.AI_GLOBAL_RATE_LIMIT_WINDOW_MS,
        max: env.AI_GLOBAL_RATE_LIMIT_MAX,
      });
    this.problemRepo = deps.problemRepo ?? problemRepository;
  }

  /** Drops cached generations. Used when the model, prompt version or key changes. */
  invalidateCache(): void {
    this.cache.clear();
  }

  status(): AiStatusResult {
    return {
      enabled: isConfigured(),
      model: isConfigured() ? env.GEMINI_MODEL : null,
      features: Object.keys(AI_FEATURE_DEFINITIONS) as AiFeature[],
    };
  }

  async generate(
    userId: string,
    problemId: string,
    input: AiGenerationInput
  ): Promise<AiGenerationResult> {
    const definition = AI_FEATURE_DEFINITIONS[input.feature];
    if (!definition) {
      throw new AppError('Unsupported AI feature.', 400, 'INVALID_AI_FEATURE');
    }

    if (!isConfigured()) {
      throw new AppError(
        'AI assistance is not configured on this server. Your DSA Tracker remains fully usable.',
        503,
        'AI_NOT_CONFIGURED'
      );
    }

    const problem = await this.problemRepo.findById(problemId, userId);
    if (!problem) {
      // Same generic 404 as every other problem endpoint: never reveal another user's row.
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    const level: HintLevel = input.feature === 'hint' ? input.level ?? 1 : 1;
    const context = buildContext(problem, input.feature, input.code);
    const model = env.GEMINI_MODEL;

    // Public metadata may be shared between users tracking the same LeetCode problem;
    // anything derived from the user's notes or code is scoped to that user.
    const shareable = !definition.usesPrivateContext && isPublicProblem(problem);
    const cacheKey = hash({
      promptVersion: AI_PROMPT_VERSION,
      model,
      feature: input.feature,
      level: input.feature === 'hint' ? level : undefined,
      code: context.code,
      scope: shareable ? `public:${context.leetcodeNumber ?? context.title}` : `user:${userId}`,
      context,
    });

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        feature: input.feature,
        model: cached.model,
        cached: true,
        content: cached.content,
        meta: {
          promptVersion: AI_PROMPT_VERSION,
          generatedAt: cached.generatedAt,
          ...(input.feature === 'hint' ? { level } : {}),
        },
      };
    }

    const userDecision = this.userLimiter.consume(userId);
    if (!userDecision.allowed) {
      throw new AppError(
        'You have reached your AI assistance limit for now. Please try again later.',
        429,
        'AI_RATE_LIMITED',
        { retryAfterSeconds: Math.ceil(userDecision.retryAfterMs / 1000) }
      );
    }

    const globalDecision = this.globalLimiter.consume('global');
    if (!globalDecision.allowed) {
      throw new AppError(
        'AI assistance is temporarily unavailable because the shared AI quota has been reached. Your DSA Tracker remains fully usable.',
        503,
        'AI_QUOTA_EXHAUSTED',
        { retryAfterSeconds: Math.ceil(globalDecision.retryAfterMs / 1000) }
      );
    }

    const { systemInstruction, prompt } = buildPrompt({ feature: input.feature, level, context });

    const content = await this.requestValidatedContent({
      feature: input.feature,
      model,
      systemInstruction,
      prompt,
      jsonSchema: definition.jsonSchema,
      maxOutputTokens: definition.maxOutputTokens,
      level,
      hadCode: Boolean(context.code),
    });

    const generatedAt = new Date().toISOString();
    this.cache.set(cacheKey, { content, model, generatedAt });

    return {
      feature: input.feature,
      model,
      cached: false,
      content,
      meta: {
        promptVersion: AI_PROMPT_VERSION,
        generatedAt,
        ...(input.feature === 'hint' ? { level } : {}),
      },
    };
  }

  /**
   * One provider call, then at most one repair call if the output does not validate.
   * A second failure is a safe error — never a partial, unvalidated response.
   */
  private async requestValidatedContent(options: {
    feature: AiFeature;
    model: string;
    systemInstruction: string;
    prompt: string;
    jsonSchema: Record<string, unknown>;
    maxOutputTokens: number;
    level: HintLevel;
    hadCode: boolean;
  }): Promise<AiFeatureContent> {
    const definition = AI_FEATURE_DEFINITIONS[options.feature];

    const parse = (raw: string): { content: AiFeatureContent } | { issues: string } => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripCodeFences(raw));
      } catch {
        return { issues: '(root): response was not valid JSON' };
      }

      const result = definition.schema.safeParse(parsed);
      if (!result.success) {
        return { issues: issuesToString(result.error) };
      }

      const semantic = semanticIssues(
        options.feature,
        result.data as AiFeatureContent,
        options.level,
        options.hadCode
      );
      if (semantic) {
        return { issues: semantic };
      }

      return { content: result.data as AiFeatureContent };
    };

    let raw: string;
    try {
      const response = await this.provider.generateStructured({
        model: options.model,
        systemInstruction: options.systemInstruction,
        prompt: options.prompt,
        jsonSchema: options.jsonSchema,
        maxOutputTokens: options.maxOutputTokens,
      });
      raw = response.text;
    } catch (error) {
      throw this.providerError(error);
    }

    const first = parse(raw);
    if ('content' in first) {
      return first.content;
    }

    // Single constrained repair attempt.
    let repairedRaw: string;
    try {
      const repaired = await this.provider.generateStructured({
        model: options.model,
        systemInstruction: options.systemInstruction,
        prompt: buildRepairPrompt(raw, first.issues),
        jsonSchema: options.jsonSchema,
        maxOutputTokens: options.maxOutputTokens,
      });
      repairedRaw = repaired.text;
    } catch (error) {
      throw this.providerError(error);
    }

    const second = parse(repairedRaw);
    if ('content' in second) {
      return second.content;
    }

    throw new AppError(
      'The AI response could not be validated. Please try again.',
      502,
      'AI_INVALID_RESPONSE'
    );
  }

  private providerError(error: unknown): AppError {
    if (error instanceof AiProviderError) {
      return mapProviderError(error);
    }
    return new AppError('AI assistance failed unexpectedly. Please try again.', 502, 'AI_UNAVAILABLE');
  }
}

export const aiService = new AiService();
