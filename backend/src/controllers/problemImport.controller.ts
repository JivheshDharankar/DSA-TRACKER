import { Request, Response, NextFunction } from 'express';
import {
  problemImportService,
  LeetcodeImportPreview,
} from '../services/problemImport.service.js';
import { ApiResponse } from '../types/index.js';

/**
 * LeetCode import controller.
 * ===========================
 * Thin by design: authentication, body validation and rate limiting happen in middleware;
 * URL normalisation, retrieval and duplicate detection live in the service. The controller
 * only maps the outcome onto the project's existing response envelope.
 *
 * Status codes:
 *   200 — the URL is a valid LeetCode problem URL. `data.status` then distinguishes
 *         `IMPORTED` / `PARTIAL` / `UNAVAILABLE`; the last two are not errors, they are
 *         the supported manual-fallback path.
 *   400 — not a LeetCode problem URL (`INVALID_LEETCODE_URL`).
 *   401 — unauthenticated, same as every other problem endpoint.
 *   500 — unexpected failure, sanitised by the shared error handler.
 */
export class ProblemImportController {
  async importFromLeetcode(
    req: Request,
    res: Response<ApiResponse<LeetcodeImportPreview>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const preview = await problemImportService.importFromLeetcode(userId, req.body.url);

      res.status(200).json({
        success: true,
        message:
          preview.status === 'IMPORTED'
            ? 'LeetCode problem details retrieved.'
            : "Couldn't import this problem automatically. You can enter the details manually.",
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const problemImportController = new ProblemImportController();
