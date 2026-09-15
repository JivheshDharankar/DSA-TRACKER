import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Protected dashboard endpoint
router.use(requireAuth);
router.get('/', dashboardController.getDashboard);

export default router;
