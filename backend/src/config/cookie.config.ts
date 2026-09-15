import { CookieOptions } from 'express';
import { env } from './env.js';

export const AUTH_COOKIE_NAME = 'dsa_auth_token';

/**
 * Parses duration strings like '7d', '24h', '60m', '30s', or numeric strings into milliseconds.
 * Aligns cookie maxAge dynamically with JWT_EXPIRES_IN.
 */
export const parseDurationToMs = (duration: string): number => {
  const match = duration.trim().match(/^(\d+)([smhdwy])?$/i);
  if (!match) {
    // Default fallback to 7 days if unparseable
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = parseInt(match[1]!, 10);
  const unit = (match[2] || 'd').toLowerCase();

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'w':
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'y':
      return value * 365 * 24 * 60 * 60 * 1000;
    default:
      return value * 24 * 60 * 60 * 1000;
  }
};

export const getAuthCookieOptions = (): CookieOptions => {
  const isProduction = env.NODE_ENV === 'production';
  const maxAgeMs = parseDurationToMs(env.JWT_EXPIRES_IN);

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax', // 'lax' permits local dev proxying while strictly guarding against CSRF
    maxAge: maxAgeMs, // Dynamically computed from JWT_EXPIRES_IN
    path: '/',
  };
};

export const getClearCookieOptions = (): CookieOptions => {
  const isProduction = env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  };
};
