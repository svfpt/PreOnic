import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  updatePassword,
  getMe,
  updateProfile,
  deactivateAccount,
  verifyEmail,
  resendVerificationEmail,
  googleLogin,
} from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateUpdatePassword,
} from '../middlewares/validation.middleware';
import {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
} from '../middlewares/rateLimit.middleware';

const router = Router();

// ===== PUBLIC ROUTES =====

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user (farmer or enterprise)
 * @access  Public
 */
router.post('/register', registerLimiter, validateRegister, register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user with email/phone + password
 * @access  Public
 */
router.post('/login', authLimiter, validateLogin, login);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh-token', authLimiter, refreshToken);

/**
 * @route   POST /api/v1/auth/google
 * @desc    Login or register with Google OAuth
 * @access  Public
 */
router.post('/google', authLimiter, googleLogin);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset token
 * @access  Public
 */
router.post('/forgot-password', passwordResetLimiter, validateForgotPassword, forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password', passwordResetLimiter, validateResetPassword, resetPassword);

// ===== PROTECTED ROUTES (require login) =====

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', protect, getMe);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Private
 */
router.post('/logout', protect, logout);

/**
 * @route   PUT /api/v1/auth/update-password
 * @desc    Update password (requires current password)
 * @access  Private
 */
router.put('/update-password', protect, validateUpdatePassword, updatePassword);

/**
 * @route   PUT /api/v1/auth/update-profile
 * @desc    Update user profile info (name, phone, avatar)
 * @access  Private
 */
router.put('/update-profile', protect, updateProfile);

/**
 * @route   GET /api/v1/auth/verify-email/:token
 * @desc    Verify email address with token from verification link
 * @access  Public
 */
router.get('/verify-email/:token', verifyEmail);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Private
 */
router.post('/resend-verification', protect, resendVerificationEmail);

/**
 * @route   DELETE /api/v1/auth/deactivate
 * @desc    Deactivate user account (soft delete)
 * @access  Private
 */
router.delete('/deactivate', protect, deactivateAccount);

export default router;
