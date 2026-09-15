import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.middleware.js';

const BCRYPT_SALT_ROUNDS = 12;

export interface JwtAuthPayload {
  userId: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  passwordHash: string
): Promise<boolean> => {
  return bcrypt.compare(password, passwordHash);
};

export const generateToken = (payload: JwtAuthPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const verifyToken = (token: string): JwtAuthPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtAuthPayload;
    if (!decoded || !decoded.userId) {
      throw new AppError('Invalid token payload', 401, 'INVALID_TOKEN');
    }
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Authentication session has expired', 401, 'TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid authentication token', 401, 'INVALID_TOKEN');
    }
    throw error;
  }
};
