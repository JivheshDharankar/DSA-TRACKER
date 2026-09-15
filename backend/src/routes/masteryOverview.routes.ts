import { Router } from 'express';
import { masteryController } from '../controllers/mastery.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// All mastery overview routes require authentication
router.use(requireAuth);

// GET /api/v1/mastery/overview - Bulk 4-gate mastery evaluation for all user problems (Zero N+1)
router.get('/overview', masteryController.getMasteryOverview);

export default router;
