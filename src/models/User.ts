import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User profile interface
 */
export interface IUserProfile {
  name?: string;
  visaType?: string;
  visaExpiry?: Date;
  linkedInUrl?: string;
  preferredLocation?: string[];
  resumeId?: string;
  resumeFileName?: string;
  resumeUploadDate?: Date;
}

/**
 * User document interface
 */
export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  profile: IUserProfile;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
  generateVerificationCode(): string;
  toResponse(): IUserResponse;
}

/**
 * User input interface for registration
 */
export interface IUserCreate {
  email: string;
  password: string;
}

/**
 * User response interface (excluding sensitive data)
 */
export interface IUserResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  profile: IUserProfile;
  createdAt: Date;
}

/**
 * User Schema
 */
const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Don't include in queries by default
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      select: false,
    },
    verificationCodeExpires: {
      type: Date,
      select: false,
    },
    profile: {
      name: String,
      visaType: String,
      visaExpiry: Date,
      linkedInUrl: String,
      preferredLocation: [String],
      resumeId: String,
      resumeFileName: String,
      resumeUploadDate: Date,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Index for verification code lookups with expiry
UserSchema.index({ verificationCode: 1, verificationCodeExpires: 1 });

/**
 * Compare password method
 */
UserSchema.methods.comparePassword = async function (
  this: IUser,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

/**
 * Generate verification code method
 */
UserSchema.methods.generateVerificationCode = function (this: IUser): string {
  // Generate a 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.verificationCode = code;
  // Code expires in 15 minutes
  this.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
  return code;
};

/**
 * Convert user to response format (excluding sensitive data)
 */
UserSchema.methods.toResponse = function (this: IUser): IUserResponse {
  return {
    id: this._id.toString(),
    email: this.email,
    emailVerified: this.emailVerified,
    profile: this.profile,
    createdAt: this.createdAt,
  };
};

/**
 * Pre-save hook to hash password
 */
UserSchema.pre('save', async function () {
  // Only hash password if it has been modified
  if (!this.isModified('passwordHash')) {
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  } catch (error) {
    throw error;
  }
});

/**
 * User Model
 */
const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
