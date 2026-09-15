import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { ApiResponse } from '../types/index.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_SERVER_ERROR',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(
    new AppError(
      `Resource not found: [${req.method}] ${req.originalUrl}`,
      404,
      'NOT_FOUND'
    )
  );
};

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal server error occurred';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ZodError' || (err as { errors?: unknown[] }).errors) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = (err as { errors?: { message?: string }[] }).errors?.[0]?.message || 'Validation failed';
    details = (err as { errors?: unknown }).errors;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID_FORMAT';
    message = 'Invalid resource identifier format';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authorization token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authorization token has expired';
  } else if ((err as { code?: number }).code === 11000) {
    statusCode = 409;
    code = 'CONCURRENT_UPDATE';
    message = 'A concurrent conflict or duplicate entry was detected';
  } else {
    // Unhandled system error
    if (env.NODE_ENV !== 'production') {
      message = err.message || message;
    }
  }

  // Development debugging log
  if (env.NODE_ENV === 'development') {
    console.error(`[ERROR ${statusCode} - ${code}]:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(details !== undefined ? { details } : {}),
    },
  });
};
