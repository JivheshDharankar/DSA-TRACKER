import { Request, Response, NextFunction } from 'express';
import { problemService, PaginatedProblemsResponse } from '../services/problem.service.js';
import { listProblemsQuerySchema } from '../validators/problem.validator.js';
import { ApiResponse } from '../types/index.js';
import { IProblemDocument } from '../models/Problem.model.js';

export class ProblemController {
  async createProblem(
    req: Request,
    res: Response<ApiResponse<{ problem: IProblemDocument }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const problem = await problemService.createProblem(userId, req.body);

      res.status(201).json({
        success: true,
        message: 'Problem created successfully.',
        data: { problem },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProblems(
    req: Request,
    res: Response<ApiResponse<PaginatedProblemsResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parsedQuery = listProblemsQuerySchema.parse(req.query);
      const result = await problemService.getProblems(userId, parsedQuery);

      res.status(200).json({
        success: true,
        message: 'Problems retrieved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProblemById(
    req: Request,
    res: Response<ApiResponse<{ problem: IProblemDocument }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const problem = await problemService.getProblemById(userId, req.params.id!);

      res.status(200).json({
        success: true,
        message: 'Problem details retrieved successfully.',
        data: { problem },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProblem(
    req: Request,
    res: Response<ApiResponse<{ problem: IProblemDocument }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const updatedProblem = await problemService.updateProblem(
        userId,
        req.params.id!,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Problem updated successfully.',
        data: { problem: updatedProblem },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteProblem(
    req: Request,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      await problemService.deleteProblem(userId, req.params.id!);

      res.status(200).json({
        success: true,
        message: 'Problem deleted successfully.',
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const problemController = new ProblemController();
