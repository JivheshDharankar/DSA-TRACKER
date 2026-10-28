/**
 * LeetCode URL parsing and normalisation.
 * =======================================
 * The import endpoint accepts a pasted LeetCode problem URL, so the URL is untrusted
 * input. This module is the single place that decides what a "LeetCode problem URL"
 * means: it pins the protocol, host, port and path shape before anything is fetched or
 * persisted. Anything that does not match is rejected, which is what keeps the import
 * endpoint from turning into a generic URL-fetching proxy.
 *
 * Accepted (canonical URL is always https://leetcode.com/problems/<slug>/):
 *   https://leetcode.com/problems/two-sum/
 *   https://leetcode.com/problems/two-sum
 *   https://www.leetcode.com/problems/two-sum/?envType=study-plan&envId=x#description
 *   https://leetcode.com/problems/two-sum/description/
 *
 * Rejected: other hosts and look-alike subdomains, credentials in the URL, explicit
 * ports, non-http(s) schemes, IP literals, missing/empty slugs and any other path.
 */

/** LeetCode slugs are lower-case words separated by single hyphens. */
export const LEETCODE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Only these hosts may be imported from. `www.` is the same site. */
const LEETCODE_HOSTS = new Set(['leetcode.com', 'www.leetcode.com']);

/**
 * LeetCode serves the same problem under these trailing segments; all of them normalise
 * to the canonical problem URL instead of being treated as a different problem.
 */
const PROBLEM_SUBPATHS = new Set(['description', 'solutions', 'submissions', 'editorial', 'discussion', 'discuss']);

const MAX_URL_LENGTH = 500;
const MAX_SLUG_LENGTH = 160;

export interface ParsedLeetcodeProblemUrl {
  /** Normalised problem slug, e.g. `two-sum`. */
  slug: string;
  /** Canonical URL that is persisted as the problem's LeetCode link. */
  canonicalUrl: string;
  /**
   * Human-readable title guessed from the slug. This is a *suggestion* derived from the
   * URL, never presented as verified metadata: it only exists so the manual fallback can
   * offer a starting point when metadata retrieval is unavailable.
   */
  suggestedTitle: string;
}

/** `two-sum` → `Two Sum`. Numbers keep their digits (`3sum` → `3sum`). */
export const suggestTitleFromSlug = (slug: string): string =>
  slug
    .split('-')
    .filter(Boolean)
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');

/**
 * Parses and normalises a pasted LeetCode problem URL.
 * Returns `null` for anything that is not a LeetCode problem URL.
 */
export const parseLeetcodeProblemUrl = (input: unknown): ParsedLeetcodeProblemUrl | null => {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // Only http(s); http is accepted and upgraded to https in the canonical URL.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }

  // Reject embedded credentials and non-default ports: both are host-confusion vectors.
  if (url.username || url.password || url.port) {
    return null;
  }

  if (!LEETCODE_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2 || segments.length > 3 || segments[0] !== 'problems') {
    return null;
  }

  const slug = segments[1]!;
  if (slug.length > MAX_SLUG_LENGTH || !LEETCODE_SLUG_PATTERN.test(slug)) {
    return null;
  }

  const subPath = segments[2];
  if (subPath && !PROBLEM_SUBPATHS.has(subPath)) {
    return null;
  }

  // Query strings and fragments are harmless and simply dropped.
  return {
    slug,
    canonicalUrl: `https://leetcode.com/problems/${slug}/`,
    suggestedTitle: suggestTitleFromSlug(slug),
  };
};
