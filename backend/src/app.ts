import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

export const createApp = (): Express => {
  const app = express();

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    })
  );

  // Strict CORS configuration
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Request body parsing with strict size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Cookie parsing for secure HTTP-only sessions
  app.use(cookieParser());

  // Mount API v1 router
  app.use('/api/v1', apiRoutes);

  // Catch unhandled 404 routes
  app.use(notFoundHandler);

  // Centralized error handling middleware
  app.use(errorHandler);

  return app;
};
