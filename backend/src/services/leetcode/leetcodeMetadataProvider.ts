import type { ProblemDifficulty } from '../../models/Problem.model.js';

/**
 * LeetCode metadata provider.
 * ==========================
 * This is the only module that talks to LeetCode. Everything else (controller, service,
 * UI) depends on the `LeetCodeMetadataProvider` interface, so the retrieval mechanism can
 * be replaced later without touching the import flow.
 *
 * Mechanism and its limits
 * ------------------------
 * LeetCode publishes no official public metadata API. The only machine-readable source is
 * the GraphQL endpoint its own web client uses. That endpoint is undocumented, can be
 * gated by anti-bot controls, and may change without notice, so retrieval here is strictly
 * best-effort:
 *
 *   - the request target is a hard-coded constant (only the validated slug is sent), so
 *     this can never become a generic URL fetcher or reach internal addresses;
 *   - redirects are rejected outright rather than followed;
 *   - every request is bounded by a short timeout;
 *   - the client identifies itself honestly and sends no cookies or forged browser
 *     headers — nothing here tries to defeat a challenge or rate limit;
 *   - any non-2xx response, challenge page, malformed payload or network failure is
 *     converted into `LeetCodeMetadataUnavailableError`, which the service turns into a
 *     supported manual fallback rather than an error the user is stuck on.
 */

export const LEETCODE_GRAPHQL_ENDPOINT = 'https://leetcode.com/graphql';

/** Hard ceiling for the whole request; the UI has already shown a loading state by then. */
export const LEETCODE_REQUEST_TIMEOUT_MS = 4000;

const METADATA_QUERY = `query problemImportMetadata($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    difficulty
  }
}`;

export interface LeetCodeProblemMetadata {
  /** Verified title, or `null` when the payload did not contain a usable one. */
  title: string | null;
  difficulty: ProblemDifficulty | null;
  leetcodeNumber: number | null;
}

export interface LeetCodeMetadataProvider {
  fetchProblemMetadata(slug: string): Promise<LeetCodeProblemMetadata>;
}

export type LeetCodeUnavailableReason =
  | 'http_error'
  | 'timeout'
  | 'invalid_payload'
  | 'network_error';

export class LeetCodeMetadataUnavailableError extends Error {
  public readonly reason: LeetCodeUnavailableReason;

  constructor(reason: LeetCodeUnavailableReason, message = 'LeetCode metadata is unavailable.') {
    super(message);
    this.name = 'LeetCodeMetadataUnavailableError';
    this.reason = reason;
  }
}

const isDifficulty = (value: unknown): value is ProblemDifficulty =>
  value === 'Easy' || value === 'Medium' || value === 'Hard';

const toLeetcodeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d{1,6}$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return parsed > 0 ? parsed : null;
  }
  return null;
};

/**
 * Maps the GraphQL payload onto the fields the tracker actually stores.
 * Unknown or malformed fields become `null` instead of being guessed.
 */
export const parseLeetCodeMetadataPayload = (payload: unknown): LeetCodeProblemMetadata => {
  const question = (payload as { data?: { question?: unknown } } | null)?.data?.question;
  if (!question || typeof question !== 'object') {
    throw new LeetCodeMetadataUnavailableError('invalid_payload');
  }

  const record = question as Record<string, unknown>;
  const rawTitle = record['title'];
  const title =
    typeof rawTitle === 'string' && rawTitle.trim().length > 0
      ? rawTitle.trim().slice(0, 200)
      : null;
  const difficulty = isDifficulty(record['difficulty']) ? record['difficulty'] : null;
  const leetcodeNumber = toLeetcodeNumber(record['questionFrontendId']);

  if (!title && !difficulty) {
    throw new LeetCodeMetadataUnavailableError('invalid_payload');
  }

  return { title, difficulty, leetcodeNumber };
};

export class LeetCodeGraphQLProvider implements LeetCodeMetadataProvider {
  constructor(
    private readonly endpoint: string = LEETCODE_GRAPHQL_ENDPOINT,
    private readonly timeoutMs: number = LEETCODE_REQUEST_TIMEOUT_MS
  ) {}

  async fetchProblemMetadata(slug: string): Promise<LeetCodeProblemMetadata> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        // Never follow a redirect: a redirect target would escape the pinned host.
        redirect: 'error',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-store',
          'User-Agent': 'DSA-Tracker/1.0 (self-hosted problem import)',
        },
        body: JSON.stringify({ query: METADATA_QUERY, variables: { titleSlug: slug } }),
      });

      if (!response.ok) {
        throw new LeetCodeMetadataUnavailableError('http_error');
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        // A challenge/HTML page is not a metadata payload.
        throw new LeetCodeMetadataUnavailableError('invalid_payload');
      }

      return parseLeetCodeMetadataPayload(payload);
    } catch (error) {
      if (error instanceof LeetCodeMetadataUnavailableError) {
        throw error;
      }
      const aborted =
        controller.signal.aborted || (error as { name?: string } | null)?.name === 'AbortError';
      throw new LeetCodeMetadataUnavailableError(aborted ? 'timeout' : 'network_error');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const leetcodeMetadataProvider: LeetCodeMetadataProvider = new LeetCodeGraphQLProvider();
