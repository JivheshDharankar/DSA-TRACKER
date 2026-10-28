import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseLeetcodeProblemUrl, suggestTitleFromSlug } from '../src/utils/leetcode.util.js';
import {
  LeetCodeGraphQLProvider,
  LeetCodeMetadataUnavailableError,
} from '../src/services/leetcode/leetcodeMetadataProvider.js';
import { ProblemImportService } from '../src/services/problemImport.service.js';
import type { LeetCodeMetadataProvider } from '../src/services/leetcode/leetcodeMetadataProvider.js';
import type { IProblemRepository } from '../src/repositories/problem.repository.js';

/**
 * Phase 2A — LeetCode import, pure logic.
 * No database and no live LeetCode: the provider is stubbed here, and the HTTP layer is
 * covered separately in `leetcodeImport.api.test.ts`.
 */

describe('LeetCode URL parsing', () => {
  it.each([
    ['https://leetcode.com/problems/two-sum/', 'two-sum'],
    ['https://leetcode.com/problems/two-sum', 'two-sum'],
    ['https://www.leetcode.com/problems/two-sum/', 'two-sum'],
    ['http://leetcode.com/problems/two-sum', 'two-sum'],
    ['https://leetcode.com/problems/3sum/', '3sum'],
    ['https://leetcode.com/problems/two-sum/?envType=study-plan&envId=x', 'two-sum'],
    ['https://leetcode.com/problems/two-sum/#description', 'two-sum'],
    ['https://leetcode.com/problems/two-sum/description/', 'two-sum'],
    ['  https://leetcode.com/problems/two-sum/  ', 'two-sum'],
  ])('normalises %s to the %s slug', (input, slug) => {
    const parsed = parseLeetcodeProblemUrl(input);

    expect(parsed).not.toBeNull();
    expect(parsed!.slug).toBe(slug);
    // Canonical form is always https, with no query string, fragment or extra segments.
    expect(parsed!.canonicalUrl).toBe(`https://leetcode.com/problems/${slug}/`);
  });

  it.each([
    ['https://example.com/problems/two-sum/'],
    ['https://leetcode.com.evil.example/problems/two-sum/'],
    ['https://leetcode.com@evil.example/problems/two-sum/'],
    ['https://leetcode.com:8443/problems/two-sum/'],
    ['javascript:alert(1)'],
    ['ftp://leetcode.com/problems/two-sum/'],
    ['http://127.0.0.1/problems/two-sum/'],
    ['http://169.254.169.254/latest/meta-data/'],
    ['https://leetcode.com/'],
    ['https://leetcode.com/problems/'],
    ['https://leetcode.com/problemset/'],
    ['https://leetcode.com/problems/two_sum/'],
    ['https://leetcode.com/problems/two-sum/some-unknown-subpage/'],
    ['not a url at all'],
    [''],
  ])('rejects %s', (input) => {
    expect(parseLeetcodeProblemUrl(input)).toBeNull();
  });

  it('rejects non-string and oversized input', () => {
    expect(parseLeetcodeProblemUrl(undefined)).toBeNull();
    expect(parseLeetcodeProblemUrl(42)).toBeNull();
    expect(parseLeetcodeProblemUrl(`https://leetcode.com/problems/${'a'.repeat(600)}/`)).toBeNull();
  });

  it('suggests a readable title from the slug without claiming it is verified', () => {
    expect(suggestTitleFromSlug('two-sum')).toBe('Two Sum');
    expect(suggestTitleFromSlug('longest-substring-without-repeating-characters')).toBe(
      'Longest Substring Without Repeating Characters'
    );
  });
});

describe('LeetCode metadata provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps a GraphQL payload onto the stored fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { question: { questionFrontendId: '1', title: 'Two Sum', difficulty: 'Easy' } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new LeetCodeGraphQLProvider();
    await expect(provider.fetchProblemMetadata('two-sum')).resolves.toEqual({
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcodeNumber: 1,
    });

    // Pinned endpoint only, POST, and redirects are never followed.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://leetcode.com/graphql');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(JSON.parse(String(init.body))).toMatchObject({ variables: { titleSlug: 'two-sum' } });
  });

  it('treats a blocked (non-2xx) response as unavailable rather than an error to surface', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('blocked', { status: 403 })));

    const provider = new LeetCodeGraphQLProvider();
    await expect(provider.fetchProblemMetadata('two-sum')).rejects.toMatchObject({
      name: 'LeetCodeMetadataUnavailableError',
      reason: 'http_error',
    });
  });

  it('treats an HTML/challenge body as unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>just a moment…</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );

    const provider = new LeetCodeGraphQLProvider();
    await expect(provider.fetchProblemMetadata('two-sum')).rejects.toMatchObject({
      reason: 'invalid_payload',
    });
  });

  it('aborts and reports a timeout when the request hangs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const abortError = new Error('aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          })
      )
    );

    const provider = new LeetCodeGraphQLProvider(undefined, 20);
    await expect(provider.fetchProblemMetadata('two-sum')).rejects.toMatchObject({
      reason: 'timeout',
    });
  });

  it('never lets a network failure escape as a raw error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1')));

    const provider = new LeetCodeGraphQLProvider();
    const error = await provider.fetchProblemMetadata('two-sum').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(LeetCodeMetadataUnavailableError);
    expect((error as Error).message).not.toMatch(/ECONNREFUSED/);
  });
});

describe('Problem import service', () => {
  const stubRepo = (existing: unknown = null) =>
    ({ findByLeetcodeSlug: vi.fn().mockResolvedValue(existing) }) as unknown as IProblemRepository;

  const stubProvider = (
    impl: LeetCodeMetadataProvider['fetchProblemMetadata']
  ): LeetCodeMetadataProvider => ({ fetchProblemMetadata: vi.fn(impl) });

  it('returns a full preview when metadata is retrieved', async () => {
    const service = new ProblemImportService(
      stubProvider(async () => ({ title: 'Two Sum', difficulty: 'Easy', leetcodeNumber: 1 })),
      stubRepo()
    );

    const preview = await service.importFromLeetcode('user-1', 'https://leetcode.com/problems/two-sum/');

    expect(preview).toMatchObject({
      source: 'LeetCode',
      slug: 'two-sum',
      url: 'https://leetcode.com/problems/two-sum/',
      suggestedTitle: 'Two Sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcodeNumber: 1,
      status: 'IMPORTED',
      duplicate: null,
    });
    expect(preview.message).toBeUndefined();
  });

  it('reports PARTIAL when only some metadata came back', async () => {
    const service = new ProblemImportService(
      stubProvider(async () => ({ title: null, difficulty: 'Hard', leetcodeNumber: null })),
      stubRepo()
    );

    const preview = await service.importFromLeetcode('user-1', 'https://leetcode.com/problems/two-sum');

    expect(preview.status).toBe('PARTIAL');
    expect(preview.difficulty).toBe('Hard');
    expect(preview.title).toBeNull();
    expect(preview.message).toMatch(/complete the rest manually/i);
  });

  it('falls back to UNAVAILABLE with a slug-based suggestion when retrieval fails', async () => {
    const service = new ProblemImportService(
      stubProvider(async () => {
        throw new LeetCodeMetadataUnavailableError('http_error');
      }),
      stubRepo()
    );

    const preview = await service.importFromLeetcode('user-1', 'https://leetcode.com/problems/two-sum/');

    expect(preview.status).toBe('UNAVAILABLE');
    expect(preview.title).toBeNull();
    expect(preview.difficulty).toBeNull();
    expect(preview.suggestedTitle).toBe('Two Sum');
    expect(preview.url).toBe('https://leetcode.com/problems/two-sum/');
    expect(preview.message).toMatch(/enter the problem details manually/i);
  });

  it('treats an unexpected provider bug as unavailable instead of a 500', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = new ProblemImportService(
      stubProvider(async () => {
        throw new Error('unexpected parser crash');
      }),
      stubRepo()
    );

    const preview = await service.importFromLeetcode('user-1', 'https://leetcode.com/problems/two-sum/');

    expect(preview.status).toBe('UNAVAILABLE');
    consoleError.mockRestore();
  });

  it('flags an existing problem with the same slug instead of creating a duplicate silently', async () => {
    const repo = stubRepo({ id: 'existing-1', sNo: 4, title: 'Two Sum', section: 'PERSONAL' });
    const service = new ProblemImportService(
      stubProvider(async () => ({ title: 'Two Sum', difficulty: 'Easy', leetcodeNumber: 1 })),
      repo
    );

    const preview = await service.importFromLeetcode('user-1', 'https://leetcode.com/problems/two-sum');

    expect(preview.duplicate).toEqual({
      id: 'existing-1',
      sNo: 4,
      title: 'Two Sum',
      section: 'PERSONAL',
    });
    expect(repo.findByLeetcodeSlug).toHaveBeenCalledWith('user-1', 'two-sum');
  });

  it('rejects a non-LeetCode URL with a 400 INVALID_LEETCODE_URL before any lookup', async () => {
    const repo = stubRepo();
    const service = new ProblemImportService(stubProvider(async () => {
      throw new Error('must not be called');
    }), repo);

    await expect(
      service.importFromLeetcode('user-1', 'http://169.254.169.254/latest/meta-data/')
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_LEETCODE_URL' });
    expect(repo.findByLeetcodeSlug).not.toHaveBeenCalled();
  });
});
