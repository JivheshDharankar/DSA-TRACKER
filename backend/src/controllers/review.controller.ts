import { Request, Response, NextFunction } from 'express';
import { reviewService, ReviewService } from '../services/review.service.js';
import {
  submitReviewSchema,
  listDueReviewsQuerySchema,
  listReviewHistoryQuerySchema,
} from '../validators/review.validator.js';
import { AppError } from '../middleware/error.middleware.js';

export class ReviewController {
  constructor(private readonly reviewSvc: ReviewService = reviewService) {}

  /**
   * POST /api/v1/reviews
   * Submits a revision result and returns the new schedule state.
   */
  submitReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const validatedInput = submitReviewSchema.parse(req.body);
      const result = await this.reviewSvc.submitReview(userId, validatedInput);

      res.status(200).json({
        success: true,
        message: 'Revision recorded successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/reviews/due
   * Returns due problems for the authenticated user.
   */
  getDueReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const validatedQuery = listDueReviewsQuerySchema.parse(req.query);
      const result = await this.reviewSvc.getDueProblems(userId, validatedQuery);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/reviews/problem/:problemId
   * Returns chronological revision history for a problem.
   */
  getProblemHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const { problemId } = req.params;
      if (!problemId) {
        throw new AppError('Problem ID is required.', 400, 'BAD_REQUEST');
      }

      const validatedQuery = listReviewHistoryQuerySchema.parse(req.query);
      const result = await this.reviewSvc.getProblemHistory(userId, problemId, validatedQuery);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/reviews/history
   * Returns chronological user-wide revision history.
   */
  getUserHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const validatedQuery = listReviewHistoryQuerySchema.parse(req.query);
      const result = await this.reviewSvc.getUserHistory(userId, validatedQuery);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const reviewController = new ReviewController();
