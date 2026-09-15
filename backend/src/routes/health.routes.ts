import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';
import { getDatabaseStatus } from '../config/db.js';
import { ApiResponse, HealthCheckData } from '../types/index.js';

const router = Router();

router.get('/health', (_req: Request, res: Response<ApiResponse<HealthCheckData>>) => {
  const dbStatus = getDatabaseStatus();

  res.status(200).json({
    success: true,
    message: 'DSA Tracker API is running',
    data: {
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      database: dbStatus,
    },
  });
});

export default router;
