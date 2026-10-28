import type { ProblemDifficulty, ProblemSection } from '../models/Problem.model.js';
import { problemRepository, IProblemRepository } from '../repositories/problem.repository.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseLeetcodeProblemUrl } from '../utils/leetcode.util.js';
import {
  leetcodeMetadataProvider,
  LeetCodeMetadataProvider,
  LeetCodeMetadataUnavailableError,
} from './leetcode/leetcodeMetadataProvider.js';

/**
 * LeetCode import service.
 * ========================
 * Orchestrates one import attempt without creating anything: it validates the URL,
 * looks for an existing problem with the same slug, asks the metadata provider, and
 * returns a preview the user reviews and edits. Persistence stays on the existing
 * `POST /problems` endpoint, so an imported problem is byte-for-byte a normal problem
 * (same validation, same S.No. allocation, same Day 0 SRS state).
 *
 * Retrieval failure is a normal outcome, not an error: the service reports
 * `UNAVAILABLE` (or `PARTIAL`) with the slug-derived title suggestion, and the UI hands
 * the user the manual form. Only an invalid URL produces an HTTP error.
 */

export type LeetcodeImportStatus = 'IMPORTED' | 'PARTIAL' | 'UNAVAILABLE';

export interface LeetcodeImportDuplicate {
  id: string;
  sNo: number;
  title: string;
  section: ProblemSection;
}

export interface LeetcodeImportPreview {
  source: 'LeetCode';
  slug: string;
  url: string;
  suggestedTitle: string;
  title: string | null;
  difficulty: ProblemDifficulty | null;
  leetcodeNumber: number | null;
  status: LeetcodeImportStatus;
  message?: string;
  duplicate: LeetcodeImportDuplicate | null;
}

const UNAVAILABLE_MESSAGE =
  "Couldn't import this problem automatically. You can enter the problem details manually.";
const PARTIAL_MESSAGE =
  'Some details could not be retrieved. Review the imported fields and complete the rest manually.';

export class ProblemImportService {
  constructor(
    private readonly provider: LeetCodeMetadataProvider = leetcodeMetadataProvider,
    private readonly problemRepo: IProblemRepository = problemRepository
  ) {}

  async importFromLeetcode(userId: string, rawUrl: string): Promise<LeetcodeImportPreview> {
    const parsed = parseLeetcodeProblemUrl(rawUrl);
    if (!parsed) {
      throw new AppError(
        'Enter a valid LeetCode problem URL, for example https://leetcode.com/problems/two-sum/',
        400,
        'INVALID_LEETCODE_URL'
      );
    }

    const existing = await this.problemRepo.findByLeetcodeSlug(userId, parsed.slug);
    const duplicate: LeetcodeImportDuplicate | null = existing
      ? {
          id: existing.id,
          sNo: existing.sNo,
          title: existing.title,
          section: existing.section,
        }
      : null;

    let title: string | null = null;
    let difficulty: ProblemDifficulty | null = null;
    let leetcodeNumber: number | null = null;
    let status: LeetcodeImportStatus = 'UNAVAILABLE';
    let message: string | undefined = UNAVAILABLE_MESSAGE;

    try {
      const metadata = await this.provider.fetchProblemMetadata(parsed.slug);
      title = metadata.title;
      difficulty = metadata.difficulty;
      leetcodeNumber = metadata.leetcodeNumber;

      if (title && difficulty) {
        status = 'IMPORTED';
        message = undefined;
      } else if (title || difficulty || leetcodeNumber !== null) {
        status = 'PARTIAL';
        message = PARTIAL_MESSAGE;
      }
    } catch (error) {
      // Any retrieval problem (blocked, timed out, changed payload, offline) is expected:
      // the user still gets a usable preview built from the validated slug.
      if (!(error instanceof LeetCodeMetadataUnavailableError)) {
        console.error('[leetcode-import] unexpected provider failure:', error);
      }
      status = 'UNAVAILABLE';
      message = UNAVAILABLE_MESSAGE;
    }

    return {
      source: 'LeetCode',
      slug: parsed.slug,
      url: parsed.canonicalUrl,
      suggestedTitle: parsed.suggestedTitle,
      title,
      difficulty,
      leetcodeNumber,
      status,
      ...(message ? { message } : {}),
      duplicate,
    };
  }
}

export const problemImportService = new ProblemImportService();
