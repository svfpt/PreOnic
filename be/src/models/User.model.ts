import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IUser extends Document {
  email: string;
  password: string;
  role: 'farmer' | 'enterprise' | 'admin';
  googleId?: string;
  authProvider?: 'local' | 'google';
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  // Ẩn mềm: account bị ẩn khỏi toàn hệ thống (kể cả admin) nhưng giữ nguyên dữ liệu để khôi phục.
  isHidden?: boolean;
  isVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  refreshToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  passwordChangedAt?: Date;
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  province?: string;
  district?: string;
  ward?: string;
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  virtualBalance: number;
  reputationScore: number;
  totalRatings: number;
  // Profile chi tiết theo role — bắt buộc để được phép thao tác trên hệ thống
  farmName?: string;
  farmSize?: number;
  companyName?: string;
  taxCode?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  createPasswordResetToken(): string;
  createEmailVerificationToken(): string;
  isLocked(): boolean;
  changedPasswordAfter(jwtTimestamp: number): boolean;
  isProfileComplete(): boolean;
}

const MAX_LOGIN_ATTEMPTS = 20;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    googleId: {
      type: String,
      select: false,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    role: {
      type: String,
      enum: ['farmer', 'enterprise', 'admin'],
      required: [true, 'Role is required'],
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Ẩn mềm khỏi toàn hệ thống (kể cả admin); có thể khôi phục.
    isHidden: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    province: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
    },
    ward: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    virtualBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    reputationScore: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    farmName: { type: String, trim: true },
    farmSize: { type: Number, min: 0 },
    companyName: { type: String, trim: true },
    taxCode: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc: any, ret: any) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.googleId;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Build fullName from firstName + lastName
UserSchema.pre('save', function (next) {
  if (this.isModified('firstName') || this.isModified('lastName')) {
    this.fullName = `${this.firstName} ${this.lastName}`;
  }
  next();
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  // Set passwordChangedAt for password updates (not new user creation)
  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }

  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create password reset token
UserSchema.methods.createPasswordResetToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Token expires in 10 minutes
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

  return resetToken;
};

// Create email verification token (valid for 24 hours)
UserSchema.methods.createEmailVerificationToken = function (): string {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return verificationToken;
};

// Profile được coi là đầy đủ khi: có phone + có địa chỉ (tỉnh) + đủ trường theo role.
UserSchema.methods.isProfileComplete = function (): boolean {
  if (!this.phone || !this.fullName) return false;
  if (!this.province) return false;
  if (this.role === 'farmer') {
    return Boolean(this.farmName && this.farmName.trim());
  }
  if (this.role === 'enterprise') {
    return Boolean(this.companyName && this.companyName.trim() && this.taxCode && this.taxCode.trim());
  }
  return true;
};

// Check if account is locked due to too many failed login attempts
UserSchema.methods.isLocked = function (): boolean {
  if (this.lockUntil && this.lockUntil > new Date()) {
    return true;
  }
  return false;
};

// Check if password was changed after JWT was issued
UserSchema.methods.changedPasswordAfter = function (jwtTimestamp: number): boolean {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(
      this.passwordChangedAt.getTime() / 1000
    );
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

// Increment login attempts
UserSchema.methods.incrementLoginAttempts = async function (): Promise<void> {
  // If lock has expired, reset attempts
  if (this.lockUntil && this.lockUntil < new Date()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
  } else {
    this.loginAttempts += 1;

    // Lock account if max attempts exceeded
    if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      this.lockUntil = new Date(Date.now() + LOCK_TIME);
    }
  }

  await this.save({ validateBeforeSave: false });
};

// Reset login attempts on successful login
UserSchema.methods.resetLoginAttempts = async function (): Promise<void> {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.lastLogin = new Date();
  await this.save({ validateBeforeSave: false });
};

// Reject stale document saves after an atomic wallet debit/credit.
UserSchema.set('optimisticConcurrency', true);

// Indexes for performance
UserSchema.index({ role: 1 });
UserSchema.index({ passwordResetToken: 1 });
UserSchema.index({ emailVerificationToken: 1 });
UserSchema.index({ isActive: 1 });

export default mongoose.model<IUser>('User', UserSchema);
