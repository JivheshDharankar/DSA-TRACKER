import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';

const router = Router();

router.post(
  '/register',
  validateBody(registerSchema),
  authController.register.bind(authController)
);

router.post(
  '/login',
  validateBody(loginSchema),
  authController.login.bind(authController)
);

router.post(
  '/logout',
  authController.logout.bind(authController)
);

router.get(
  '/me',
  requireAuth,
  authController.getMe.bind(authController)
);

export default router;
