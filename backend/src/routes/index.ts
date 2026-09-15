import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import problemRoutes from './problem.routes.js';
import { reviewRouter } from './review.routes.js';
import patternRoutes from './pattern.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import masteryOverviewRoutes from './masteryOverview.routes.js';

const router = Router();

// Mount sub-routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/problems', problemRoutes);
router.use('/reviews', reviewRouter);
router.use('/patterns', patternRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/mastery', masteryOverviewRoutes);

export default router;


