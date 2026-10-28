import { NextFunction, Request, Response } from 'express';
import { aiService, AiGenerationResult, AiStatusResult } from '../services/ai/ai.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { ApiResponse } from '../types/index.js';
import { AiGenerateInput } from '../validators/ai.validator.js';

/**
 * DSA Tracker — AI assistance (Phase 2B)
 * =====================================
 * Thin HTTP layer: authentication is already enforced by the router, body validation by
 * middleware. The controller's only extra job is translating the service's retry hint into
 * a standard `Retry-After` header so a client can back off correctly.
 */

export class AiController {
  async generate(
    req: Request,
    res: Response<ApiResponse<AiGenerationResult>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const problemId = req.params.problemId!;
      const body = req.body as AiGenerateInput;

      const result = await aiService.generate(userId, problemId, {
        feature: body.feature,
        level: body.level,
        code: body.code,
      });

      res.status(200).json({
        success: true,
        message: result.cached
          ? 'AI suggestion loaded from cache.'
          : 'AI suggestion generated.',
        data: result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        const retryAfter = (error.details as { retryAfterSeconds?: number } | undefined)
          ?.retryAfterSeconds;
        if (typeof retryAfter === 'number') {
          res.setHeader('Retry-After', String(retryAfter));
        }
      }
      next(error);
    }
  }

  async status(
    _req: Request,
    res: Response<ApiResponse<AiStatusResult>>,
    next: NextFunction
  ): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        message: 'AI assistance status retrieved.',
        data: aiService.status(),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AiController();
