import { Request, Response, NextFunction } from 'express';
import { masteryService, MasteryService } from '../services/mastery.service.js';
import { ApiResponse } from '../types/index.js';

export class MasteryController {
  constructor(private readonly masterySvc: MasteryService = masteryService) {}

  /**
   * GET /api/v1/problems/:problemId/mastery
   * Pure read inspection of mastery status and 5-gate qualification breakdown.
   */
  getMastery = async (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { problemId } = req.params;

      const result = await this.masterySvc.evaluateProblemMastery(userId, problemId!);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/problems/:problemId/mastery/evaluate
   * Evaluates all 5 gates server-side. If eligible and UNLOCKED, transitions to LOCKED.
   */
  evaluateMastery = async (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { problemId } = req.params;

      const result = await this.masterySvc.evaluateAndTransition(
        userId,
        problemId!,
        'QUALIFICATION_MET'
      );

      res.status(200).json({
        success: true,
        data: {
          problemId: result.problem._id.toString(),
          masteryStatus: result.problem.masteryStatus,
          lockedAt: result.problem.lockedAt ? result.problem.lockedAt.toISOString() : null,
          unlockedAt: result.problem.unlockedAt ? result.problem.unlockedAt.toISOString() : null,
          lockVersion: result.problem.lockVersion,
          transitioned: result.transitioned,
          evaluation: result.evaluation,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/mastery/overview
   * Bulk evaluation of all user problems and their 4-gate mastery status.
   */
  getMasteryOverview = async (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const result = await this.masterySvc.getUserMasteryOverview(userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const masteryController = new MasteryController();
