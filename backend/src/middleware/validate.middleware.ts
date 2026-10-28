import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from './error.middleware.js';

/**
 * Accepts any Zod schema, not only `ZodObject`.
 * A schema with `.superRefine()` (cross-field rules, e.g. the AI request) is a `ZodEffects`
 * and would otherwise be rejected at the type level even though `parseAsync` handles it.
 */
export const validateBody = (schema: ZodTypeAny) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.errors[0]?.message || 'Validation failed';
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new AppError(firstError, 400, 'VALIDATION_ERROR', formattedErrors));
        return;
      }
      next(error);
    }
  };
};
