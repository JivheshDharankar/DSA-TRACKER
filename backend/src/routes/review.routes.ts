import { Router } from 'express';
import { reviewController } from '../controllers/review.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { submitReviewSchema } from '../validators/review.validator.js';

const router = Router();

// All review routes require an authenticated user session
router.use(requireAuth);

// POST /api/v1/reviews - Submit revision
router.post('/', validateBody(submitReviewSchema), reviewController.submitReview);

// GET /api/v1/reviews/due - List due problems
router.get('/due', reviewController.getDueReviews);

// GET /api/v1/reviews/history - List user-wide revision history
router.get('/history', reviewController.getUserHistory);

// GET /api/v1/reviews/problem/:problemId - List revision history for a problem
router.get('/problem/:problemId', reviewController.getProblemHistory);

export const reviewRouter = router;


