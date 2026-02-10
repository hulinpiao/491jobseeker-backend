import jwt from 'jsonwebtoken';

/**
 * JWT payload interface
 */
export interface IJWTPayload {
  userId: string;
  email: string;
}

/**
 * Generate JWT token
 */
export function generateToken(payload: IJWTPayload): string {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): IJWTPayload {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

  try {
    return jwt.verify(token, secret) as IJWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Decode JWT token without verification (for debugging)
 */
export function decodeToken(token: string): IJWTPayload | null {
  const decoded = jwt.decode(token);
  return decoded as IJWTPayload | null;
}
