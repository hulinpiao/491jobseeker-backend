import { Router } from 'express';
import authController, {
  registerSchema,
  verifyEmailSchema,
  loginSchema,
  resendVerificationSchema,
} from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validateMiddleware';

/**
 * Authentication Routes
 * Base path: /api/auth
 */
const router = Router();

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post(
  '/register',
  validateBody(registerSchema),
  authController.register.bind(authController)
);

/**
 * POST /api/auth/verify-email
 * Verify email address with code
 */
router.post(
  '/verify-email',
  validateBody(verifyEmailSchema),
  authController.verifyEmail.bind(authController)
);

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post(
  '/login',
  validateBody(loginSchema),
  authController.login.bind(authController)
);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, authController.me.bind(authController));

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', authController.logout.bind(authController));

/**
 * POST /api/auth/resend-verification
 * Resend verification code
 */
router.post(
  '/resend-verification',
  validateBody(resendVerificationSchema),
  authController.resendVerification.bind(authController)
);

export default router;
