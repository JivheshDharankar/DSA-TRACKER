import { Router } from 'express';
import { problemController } from '../controllers/problem.controller.js';
import { patternController } from '../controllers/pattern.controller.js';
import masteryRoutes from './mastery.routes.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  createProblemSchema,
  updateProblemSchema,
} from '../validators/problem.validator.js';

const router = Router();

// All problem endpoints strictly require verified authentication
router.use(requireAuth);

router.post(
  '/',
  validateBody(createProblemSchema),
  problemController.createProblem.bind(problemController)
);

router.get(
  '/',
  problemController.getProblems.bind(problemController)
);

router.get(
  '/:id',
  problemController.getProblemById.bind(problemController)
);

router.patch(
  '/:id',
  validateBody(updateProblemSchema),
  problemController.updateProblem.bind(problemController)
);

router.delete(
  '/:id',
  problemController.deleteProblem.bind(problemController)
);

// Problem pattern endpoints
router.get('/:problemId/patterns', patternController.getPatternsForProblem);
router.post('/:problemId/patterns', patternController.attachPattern);
router.delete('/:problemId/patterns/:patternId', patternController.detachPattern);
router.put('/:problemId/patterns/sync', patternController.syncPatterns);

// Problem mastery endpoints (Phase 8)
router.use('/:problemId/mastery', masteryRoutes);

export default router;
