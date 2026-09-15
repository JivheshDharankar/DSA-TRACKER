import { Request, Response, NextFunction } from 'express';
import { dashboardService, DashboardService } from '../services/dashboard.service.js';
import { AppError } from '../middleware/error.middleware.js';

export class DashboardController {
  constructor(private readonly dashboardSvc: DashboardService = dashboardService) {}

  /**
   * GET /api/v1/dashboard
   * Returns the consolidated dashboard read model for the authenticated user.
   */
  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const data = await this.dashboardSvc.getDashboardData(userId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const dashboardController = new DashboardController();
