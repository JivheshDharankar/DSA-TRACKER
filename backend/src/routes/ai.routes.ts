import { Router } from 'express';
import { aiController } from '../controllers/ai.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { aiGenerateSchema } from '../validators/ai.validator.js';

/**
 * DSA Tracker — AI assistance routes (Phase 2B)
 * ============================================
 *   GET  /api/v1/ai/status                              — is AI configured? (no key is exposed)
 *   POST /api/v1/ai/problems/:problemId/generate        — one feature, one suggestion
 *
 * Every route requires a verified session; there is no unauthenticated AI surface.
 */
const router = Router();

router.use(requireAuth);

router.get('/status', aiController.status.bind(aiController));

router.post(
  '/problems/:problemId/generate',
  validateBody(aiGenerateSchema),
  aiController.generate.bind(aiController)
);

export default router;
