/**
 * DSA Tracker — AI assistance (Phase 2B)
 * =====================================
 * A tiny in-process TTL cache for generated AI content.
 *
 * Why in-process: the deployment is a single Node process, and the goal is to avoid
 * duplicate provider calls for repeated identical requests, not to build a distributed
 * cache. Nothing here is persisted, so it disappears on restart by design.
 *
 * Privacy: the cache itself has no notion of users. Callers must include the owning user
 * in the key for any content derived from private notes or code (see `ai.service.ts`).
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface AiCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  size(): number;
  clear(): void;
}

export interface TtlCacheOptions {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

export class TtlCache<T> implements AiCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor({ ttlMs, maxEntries, now = Date.now }: TtlCacheOptions) {
    this.ttlMs = ttlMs;
    this.maxEntries = Math.max(1, maxEntries);
    this.now = now;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    // Re-insert so insertion order tracks recency; the oldest key is evicted first.
    this.store.delete(key);

    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (!oldest.done) {
        this.store.delete(oldest.value);
      }
    }

    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
