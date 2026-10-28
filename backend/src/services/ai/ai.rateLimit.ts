/**
 * DSA Tracker — AI assistance (Phase 2B)
 * =====================================
 * Application-level AI rate limiting.
 *
 * Google's limits are project-level (RPM/TPM/RPD) and change without notice, so this code
 * never assumes a quota number. It provides two independent safety nets:
 *
 *   - per user — so one account cannot consume the shared allowance;
 *   - global   — so unexpected traffic cannot overwhelm the provider.
 *
 * The limits are configured through `AI_USER_RATE_LIMIT_*` / `AI_GLOBAL_RATE_LIMIT_*` and are
 * deliberately conservative; they are not a claim about the actual Gemini free tier.
 *
 * Fixed-window counters are enough here: the goal is abuse protection, not precise shaping.
 */

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the current window resets. */
  retryAfterMs: number;
}

export interface WindowRateLimiterOptions {
  windowMs: number;
  max: number;
  now?: () => number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

export class WindowRateLimiter {
  private readonly store = new Map<string, WindowEntry>();
  private readonly windowMs: number;
  private readonly max: number;
  private readonly now: () => number;

  constructor({ windowMs, max, now = Date.now }: WindowRateLimiterOptions) {
    this.windowMs = windowMs;
    this.max = Math.max(1, max);
    this.now = now;
  }

  consume(key: string): RateLimitDecision {
    const now = this.now();
    const existing = this.store.get(key);

    if (!existing || existing.resetAt <= now) {
      // Opportunistic sweep keeps the map bounded when many distinct users appear.
      if (this.store.size > 5000) {
        for (const [storedKey, entry] of this.store) {
          if (entry.resetAt <= now) {
            this.store.delete(storedKey);
          }
        }
      }

      const resetAt = now + this.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.max - 1, retryAfterMs: this.windowMs };
    }

    if (existing.count >= this.max) {
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, existing.resetAt - now) };
    }

    existing.count += 1;
    return { allowed: true, remaining: this.max - existing.count, retryAfterMs: Math.max(0, existing.resetAt - now) };
  }

  reset(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
