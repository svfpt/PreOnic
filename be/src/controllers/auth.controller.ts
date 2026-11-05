import { Response, NextFunction } from 'express';
import { AuthRequest, AuthTokens } from '../types';
import { asyncHandler } from '../middlewares/error.middleware';
import { AuthService } from '../services/auth.service';
import {
  ONE_DAY_MS,
  THIRTY_DAYS_MS,
  REFRESH_TOKEN_COOKIE,
  getRefreshTokenCookieOptions,
  CLEAR_COOKIE_OPTIONS,
} from '../constants';

// ===== HELPERS =====

/** Attach refresh token as httpOnly cookie and return standard auth response */
const sendAuthResponse = (
  res: Response,
  statusCode: number,
  message: string,
  user: any,
  tokens: AuthTokens,
  cookieMaxAge: number = THIRTY_DAYS_MS
) => {
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, getRefreshTokenCookieOptions(cookieMaxAge));
  res.status(statusCode).json({
    success: true,
    status: 'success',
    message,
    data: { user, accessToken: tokens.accessToken },
  });
};

/** Clear refresh token cookie */
const clearRefreshCookie = (res: Response) => {
  res.cookie(REFRESH_TOKEN_COOKIE, '', CLEAR_COOKIE_OPTIONS);
};

/**
 * @desc    Register new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 *
 * FE sends: { fullName, email, phone, password, confirmPassword, role, agreeTerms }
 * From: Register.jsx (formData + selectedRole)
 */
export const register = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const result = await AuthService.register(req.body);

    if ('requiresVerification' in result) {
      return res.status(201).json({
        success: true,
        status: 'success',
        requiresVerification: true,
        message:
          'Tài khoản đã được tạo. Vui lòng nhập OTP được gửi qua email để xác thực tài khoản.',
        data: {
          email: result.email,
          expiresInSeconds: result.expiresInSeconds,
          resendAfterSeconds: result.resendAfterSeconds,
        },
      });
    }

    const { user, tokens } = result;
    return sendAuthResponse(res, 201, 'Đăng ký tài khoản thành công!', user, tokens);
  }
);

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 *
 * FE sends: { emailOrPhone, password, rememberMe }
 * From: Auth.jsx (formData)
 */
export const login = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { user, tokens } = await AuthService.login(req.body);
    const cookieMaxAge = req.body.rememberMe ? THIRTY_DAYS_MS : ONE_DAY_MS;
    sendAuthResponse(res, 200, 'Đăng nhập thành công!', user, tokens, cookieMaxAge);
  }
);

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    await AuthService.logout(req.user!.id);
    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Đăng xuất thành công!',
    });
  }
);

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public (requires refresh token in cookie or body)
 */
export const refreshToken = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    const tokens = await AuthService.refreshToken(token);

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, getRefreshTokenCookieOptions());

    res.status(200).json({
      success: true,
      status: 'success',
      data: { accessToken: tokens.accessToken },
    });
  }
);

/**
 * @desc    Forgot password - generate reset token
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 *
 * FE sends: { email }
 * Linked from: Auth.jsx "Quên mật khẩu?" button
 */
export const forgotPassword = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const result = await AuthService.forgotPassword(req.body);

    res.status(200).json({
      success: true,
      status: 'success',
      message: result.message,
      data: {
        // In development, return the token for testing
        // In production, remove this and only send via email
        ...(process.env.NODE_ENV === 'development' && {
          resetToken: result.resetToken,
          resetURL: `${process.env.FRONTEND_URL}/reset-password/${result.resetToken}`,
        }),
      },
    });
  }
);

/**
 * @desc    Reset password using token
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 *
 * FE sends: { token, password, confirmPassword }
 */
export const resetPassword = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    await AuthService.resetPassword(req.body);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Mật khẩu đã được đặt lại thành công! Vui lòng đăng nhập lại.',
    });
  }
);

/**
 * @desc    Update password (authenticated user)
 * @route   PUT /api/v1/auth/update-password
 * @access  Private
 *
 * FE sends: { currentPassword, newPassword, confirmNewPassword }
 */
export const updatePassword = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { user, tokens } = await AuthService.updatePassword(
      req.user!.id,
      req.body
    );
    sendAuthResponse(res, 200, 'Cập nhật mật khẩu thành công!', user, tokens);
  }
);

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const user = await AuthService.getMe(req.user!.id);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { user },
    });
  }
);

/**
 * @desc    Update user profile (name, phone, avatar - NOT password)
 * @route   PUT /api/v1/auth/update-profile
 * @access  Private
 *
 * FE sends: { fullName, phone, avatar }
 */
export const updateProfile = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const user = await AuthService.updateProfile(req.user!.id, req.body);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Cập nhật hồ sơ thành công!',
      data: { user },
    });
  }
);

/**
 * @desc    Deactivate account (soft delete)
 * @route   DELETE /api/v1/auth/deactivate
 * @access  Private
 */
export const deactivateAccount = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    await AuthService.deactivateAccount(req.user!.id);
    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Tài khoản đã được vô hiệu hóa.',
    });
  }
);

/**
 * @desc    Login / register with Google OAuth
 * @route   POST /api/v1/auth/google
 * @access  Public
 *
 * FE sends: { accessToken } (from useGoogleLogin hook)
 *       or: { credential } (from GoogleLogin component ID token)
 * Optional: { role } for new users
 */
export const googleLogin = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { user, tokens } = await AuthService.googleLogin(req.body);
    return sendAuthResponse(res, 200, 'Đăng nhập Google thành công!', user, tokens);
  }
);

/**
 * @desc    Verify email address
 * @route   POST /api/v1/auth/verify-email
 * @access  Public
 */
export const verifyEmail = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { user, tokens } = await AuthService.verifyEmail(req.body.email, req.body.otp);
    sendAuthResponse(res, 200, 'Xác thực email và đăng nhập thành công!', user, tokens);
  }
);

/**
 * @desc    Request a new email OTP
 * @route   POST /api/v1/auth/resend-verification
 * @access  Public
 */
export const resendVerificationEmail = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const result = await AuthService.resendVerificationEmail(req.body.email);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Nếu email cần xác thực và chưa vượt giới hạn gửi, OTP sẽ được gửi đến hộp thư. Kiểm tra cả thư mục Spam.',
      data: result,
    });
  }
);
