import { Request, Response, NextFunction } from 'express';
import { verifyToken, IJWTPayload } from '../utils/jwt';

/**
 * Extended Request interface with user property
 */
export interface AuthRequest extends Request {
  user?: IJWTPayload;
}

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header and attaches user to request
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require auth
 */
export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.user = payload;
  } catch (error) {
    // Ignore invalid token for optional auth
  }

  next();
}
