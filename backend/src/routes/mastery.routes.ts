import { Router } from 'express';
import { masteryController } from '../controllers/mastery.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', masteryController.getMastery);
router.post('/evaluate', masteryController.evaluateMastery);

export default router;
