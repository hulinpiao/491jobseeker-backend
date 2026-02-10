import { Response, NextFunction } from 'express';
import { z } from 'zod';
import AuthService, { AuthError } from '../services/AuthService';
import EmailService from '../services/EmailService';
import { AuthRequest } from '../middleware/authMiddleware';

/**
 * Request validation schemas
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Auth Controller
 * Handles authentication HTTP requests
 */
export class AuthController {
  /**
   * Register new user
   * POST /api/auth/register
   */
  async register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await AuthService.register(email, password);

      // Send verification email
      await EmailService.sendVerificationEmail(email, result.verificationCode);

      // Return success without exposing the verification code
      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          message: 'Registration successful. Please check your email for verification code.',
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Verify email
   * POST /api/auth/verify-email
   */
  async verifyEmail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code } = req.body;

      const result = await AuthService.verifyEmail(email, code);

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          message: 'Email verified successfully. You can now log in.',
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login(email, password);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(401).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get current user (protected route)
   * GET /api/auth/me
   */
  async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const user = await AuthService.getUserById(req.user.userId);

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(404).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   * Note: JWT is stateless, so logout is handled client-side by removing token
   */
  async logout(_req: AuthRequest, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: {
        message: 'Logout successful. Please clear your token on the client side.',
      },
    });
  }

  /**
   * Resend verification code
   * POST /api/auth/resend-verification
   */
  async resendVerification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      const code = await AuthService.resendVerificationCode(email);

      await EmailService.sendVerificationEmail(email, code);

      res.status(200).json({
        success: true,
        data: {
          message: 'Verification code sent. Please check your email.',
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }
}

// Export singleton instance
export default new AuthController();
