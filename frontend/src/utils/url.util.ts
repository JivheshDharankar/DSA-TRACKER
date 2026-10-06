/**
 * URL Sanitization & Protocol Validation Utility.
 * Defense-in-depth utility that ensures rendered external links only use safe http:// and https:// schemes.
 * Strictly rejects javascript:, data:, vbscript:, file:, ftp:, protocol-relative (//), and malformed URLs.
 */

export function getSafeUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
