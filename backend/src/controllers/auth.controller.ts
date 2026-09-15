import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions, getClearCookieOptions } from '../config/cookie.config.js';
import { ApiResponse } from '../types/index.js';
import { SafeUser } from '../models/User.model.js';

export class AuthController {
  async register(
    req: Request,
    res: Response<ApiResponse<{ user: SafeUser }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { user, token } = await authService.register(req.body);

      // Attach JWT in secure HTTP-only cookie
      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

      res.status(201).json({
        success: true,
        message: 'Account successfully registered.',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(
    req: Request,
    res: Response<ApiResponse<{ user: SafeUser }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { user, token } = await authService.login(req.body);

      // Attach JWT in secure HTTP-only cookie
      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Successfully logged in.',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(
    _req: Request,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ): Promise<void> {
    try {
      // Clear authentication cookie
      res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Successfully logged out.',
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(
    req: Request,
    res: Response<ApiResponse<{ user: SafeUser }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await authService.getMe(req.user!.userId);

      res.status(200).json({
        success: true,
        message: 'Current authenticated user profile.',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
