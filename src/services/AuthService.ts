import User, { IUserResponse } from '../models/User';
import { generateToken, IJWTPayload } from '../utils/jwt';

/**
 * Registration result interface
 */
export interface IRegistrationResult {
  user: IUserResponse;
  verificationCode: string;
}

/**
 * Login result interface
 */
export interface ILoginResult {
  user: IUserResponse;
  token: string;
}

/**
 * Verification result interface
 */
export interface IVerificationResult {
  user: IUserResponse;
}

/**
 * Error types for better error handling
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Authentication Service
 * Handles all authentication business logic
 */
export class AuthService {
  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string
  ): Promise<IRegistrationResult> {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AuthError('User with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    // Create new user (password will be hashed by pre-save hook)
    const user = new User({
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      emailVerified: false,
      profile: {},
    });

    // Generate verification code
    const verificationCode = user.generateVerificationCode();

    await user.save();

    return {
      user: user.toResponse(),
      verificationCode,
    };
  }

  /**
   * Verify email with code
   */
  async verifyEmail(email: string, code: string): Promise<IVerificationResult> {
    // Find user with verification code (select the hidden fields)
    const user = await User.findOne({
      email,
    }).select('+verificationCode +verificationCodeExpires');

    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND');
    }

    // Check if code exists and matches
    if (!user.verificationCode || user.verificationCode !== code) {
      throw new AuthError('Invalid verification code', 'INVALID_CODE');
    }

    // Check if code has expired
    if (!user.verificationCodeExpires || user.verificationCodeExpires < new Date()) {
      throw new AuthError('Verification code has expired', 'CODE_EXPIRED');
    }

    // Mark email as verified and clear verification code
    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;

    await user.save();

    return {
      user: user.toResponse(),
    };
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<ILoginResult> {
    // Find user with password hash
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new AuthError('Please verify your email before logging in', 'EMAIL_NOT_VERIFIED');
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Generate JWT token
    const payload: IJWTPayload = {
      userId: user._id.toString(),
      email: user.email,
    };

    const token = generateToken(payload);

    return {
      user: user.toResponse(),
      token,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUserResponse> {
    const user = await User.findById(userId);

    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND');
    }

    return user.toResponse();
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(email: string): Promise<string> {
    const user = await User.findOne({ email });

    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND');
    }

    if (user.emailVerified) {
      throw new AuthError('Email is already verified', 'EMAIL_ALREADY_VERIFIED');
    }

    const code = user.generateVerificationCode();
    await user.save();

    return code;
  }
}

// Export singleton instance
export default new AuthService();
