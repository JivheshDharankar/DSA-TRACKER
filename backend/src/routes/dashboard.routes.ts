import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { dashboardRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// Protected dashboard endpoint with rate limiting
router.use(requireAuth);
router.get('/', dashboardRateLimiter, dashboardController.getDashboard);

export default router;
