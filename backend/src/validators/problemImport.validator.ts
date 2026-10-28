import { z } from 'zod';

/**
 * Import request validation.
 * ==========================
 * The body is deliberately minimal: one `url` string. Host, scheme and path are parsed by
 * `parseLeetcodeProblemUrl` in the service, because that parser is also the security
 * boundary (strict allow-list, no credentials, no ports, no arbitrary paths) and must not
 * be duplicated as a looser regex here.
 *
 * `.strict()` rejects unknown keys so the endpoint cannot be extended by a caller
 * (e.g. smuggling a `section` or `userId` through the body).
 */
export const importLeetcodeSchema = z
  .object({
    url: z
      .string({ required_error: 'A LeetCode problem URL is required.' })
      .trim()
      .min(1, 'Enter a LeetCode problem URL.')
      .max(500, 'That URL is too long to be a LeetCode problem URL.'),
  })
  .strict();

export type ImportLeetcodeInput = z.infer<typeof importLeetcodeSchema>;
