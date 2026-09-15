import { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE_NAME } from '../config/cookie.config.js';
import { verifyToken } from '../utils/auth.util.js';
import { User } from '../models/User.model.js';
import { AppError } from './error.middleware.js';

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Read JWT from secure HTTP-only cookie (or Authorization header fallback for API testing)
    const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
    const headerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : undefined;

    const token = cookieToken || headerToken;

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401, 'UNAUTHORIZED');
    }

    const payload = verifyToken(token);

    const user = await User.findById(payload.userId);
    if (!user) {
      throw new AppError('Authenticated user no longer exists.', 401, 'USER_NOT_FOUND');
    }

    // Attach verified user identity to the Express request
    req.user = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    next(error);
  }
};
