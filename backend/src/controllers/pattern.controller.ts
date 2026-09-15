import { Request, Response, NextFunction } from 'express';
import { patternService, PatternService } from '../services/pattern.service.js';
import {
  attachPatternSchema,
  syncPatternsSchema,
  listPatternsQuerySchema,
} from '../validators/pattern.validator.js';
import { AppError } from '../middleware/error.middleware.js';

export class PatternController {
  constructor(private readonly patternSvc: PatternService = patternService) {}

  /**
   * GET /api/v1/patterns
   * Returns all global patterns with user mastery calculations.
   */
  getPatterns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const query = listPatternsQuerySchema.parse(req.query);
      const patterns = await this.patternSvc.getPatternsWithMastery(userId, query.search);

      res.status(200).json({
        success: true,
        data: patterns,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/patterns/:id
   * Returns pattern details, mastery breakdown, and associated problems.
   */
  getPatternDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const { id } = req.params;
      if (!id) {
        throw new AppError('Pattern ID or slug is required.', 400, 'BAD_REQUEST');
      }

      const detail = await this.patternSvc.getPatternDetail(userId, id);

      res.status(200).json({
        success: true,
        data: detail,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/problems/:problemId/patterns
   * Returns patterns attached to a problem.
   */
  getPatternsForProblem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const { problemId } = req.params;
      if (!problemId) {
        throw new AppError('Problem ID is required.', 400, 'BAD_REQUEST');
      }

      const patterns = await this.patternSvc.getPatternsForProblem(userId, problemId);

      res.status(200).json({
        success: true,
        data: patterns,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/problems/:problemId/patterns
   * Attaches a pattern to a problem.
   */
  attachPattern = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const { problemId } = req.params;
      if (!problemId) {
        throw new AppError('Problem ID is required.', 400, 'BAD_REQUEST');
      }

      const validatedInput = attachPatternSchema.parse(req.body);
      const result = await this.patternSvc.attachPattern(userId, problemId, validatedInput);

      res.status(201).json({
        success: true,
        message: 'Pattern attached successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /api/v1/problems/:problemId/patterns/:patternId
   * Detaches a pattern from a problem.
   */
  detachPattern = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const { problemId, patternId } = req.params;
      if (!problemId || !patternId) {
        throw new AppError('Problem ID and Pattern ID are required.', 400, 'BAD_REQUEST');
      }

      await this.patternSvc.detachPattern(userId, problemId, patternId);

      res.status(200).json({
        success: true,
        message: 'Pattern detached successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/v1/problems/:problemId/patterns/sync
   * Syncs/replaces all pattern associations for a problem.
   */
  syncPatterns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const { problemId } = req.params;
      if (!problemId) {
        throw new AppError('Problem ID is required.', 400, 'BAD_REQUEST');
      }

      const validatedInput = syncPatternsSchema.parse(req.body);
      const result = await this.patternSvc.syncPatterns(userId, problemId, validatedInput.patterns);

      res.status(200).json({
        success: true,
        message: 'Patterns synchronized successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const patternController = new PatternController();
