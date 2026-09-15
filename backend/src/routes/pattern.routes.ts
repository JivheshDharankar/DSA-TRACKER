import { Router } from 'express';
import { patternController } from '../controllers/pattern.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// All pattern endpoints require authentication
router.use(requireAuth);

router.get('/', patternController.getPatterns);
router.get('/:id', patternController.getPatternDetail);

export default router;
