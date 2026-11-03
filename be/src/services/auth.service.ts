import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import User, { IUser } from '../models/User.model';
import { AppError } from '../middlewares/error.middleware';
import {
  RegisterBody,
  LoginBody,
  AuthTokens,
  ForgotPasswordBody,
  ResetPasswordBody,
  UpdatePasswordBody,
  UpdateProfileBody,
  GoogleLoginBody,
} from '../types';
import {
  MAX_LOGIN_ATTEMPTS,
  LOCK_DURATION_MS,
  PASSWORD_MIN_LENGTH,
} from '../constants';
import { isTruthy, parseFullName } from '../utils/validation.util';
import {
  getSmtpConfig,
  sendEmail,
  sendVerificationEmail,
  buildPasswordResetEmailHtml,
} from './email.service';
import { createLogger } from '../utils/logger';

const log = createLogger('Auth');

type UserTokenPayload = {
  id: string;
  email: string;
  role: IUser['role'];
  fullName: string;
};

type RefreshTokenPayload = JwtPayload & {
  id: string;
};

export class AuthService {
  // Khối helper này gom cấu hình JWT/SMTP và xử lý dữ liệu nhạy cảm để các hàm nghiệp vụ chính ngắn hơn.
  private static getJwtSecret(): string {
    if (!process.env.JWT_SECRET) {
      throw new AppError('Máy chủ chưa cấu hình JWT_SECRET', 500);
    }

    return process.env.JWT_SECRET;
  }

  private static getRefreshJwtSecret(): string {
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new AppError('Máy chủ chưa cấu hình JWT_REFRESH_SECRET', 500);
    }

    return process.env.JWT_REFRESH_SECRET;
  }

  private static signToken(payload: object, secret: string, expiresIn: string): string {
    return jwt.sign(payload, secret, {
      expiresIn: expiresIn as SignOptions['expiresIn'],
    });
  }

  private static hideSensitiveFields(user: IUser): IUser {
    Reflect.set(user, 'password', undefined);
    return user;
  }

  private static ensurePasswordsMatch(password: string, confirmPassword: string, message: string): void {
    if (password !== confirmPassword) {
      throw new AppError(message, 400);
    }
  }

  private static ensurePasswordLength(password: string, label: string): void {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new AppError(`${label} phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`, 400);
    }
  }

  private static parseRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, AuthService.getRefreshJwtSecret());

      if (typeof decoded === 'string' || !decoded.id) {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      return decoded as RefreshTokenPayload;
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  // SMTP/email helpers đã chuyển sang email.service.ts theo nguyên tắc SRP.

  private static buildProfileUpdateData(body: UpdateProfileBody): Partial<UpdateProfileBody> {
    const updateData: Partial<UpdateProfileBody> = {};

    if (body.fullName !== undefined) {
      const normalizedFullName = body.fullName.trim();
      const { firstName, lastName } = parseFullName(normalizedFullName);
      updateData.fullName = normalizedFullName;
      updateData.firstName = firstName;
      updateData.lastName = lastName;
    } else {
      if (body.firstName !== undefined) {
        updateData.firstName = body.firstName;
      }
      if (body.lastName !== undefined) {
        updateData.lastName = body.lastName;
      }
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone;
    }
    if (body.avatar !== undefined) {
      updateData.avatar = body.avatar;
    }
    // Profile mở rộng: địa chỉ + trường nghiệp vụ theo role.
    const passthrough: (keyof UpdateProfileBody)[] = [
      'address', 'province', 'district', 'ward',
      'farmName', 'companyName', 'taxCode',
    ];
    for (const key of passthrough) {
      if (body[key] !== undefined) {
        (updateData as Record<string, unknown>)[key] = body[key];
      }
    }
    if (body.farmSize !== undefined && body.farmSize !== '') {
      const num = typeof body.farmSize === 'number' ? body.farmSize : Number(body.farmSize);
      if (!Number.isNaN(num)) {
        (updateData as Record<string, unknown>).farmSize = num;
      }
    }

    return updateData;
  }

  /**
   * Generate access & refresh tokens for a user
   */
  static generateTokens(user: IUser): AuthTokens {
    const payload: UserTokenPayload = {
      id: String(user._id),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    const accessToken = AuthService.signToken(
      payload,
      AuthService.getJwtSecret(),
      process.env.JWT_EXPIRE || '7d'
    );

    const refreshToken = AuthService.signToken(
      { id: String(user._id) },
      AuthService.getRefreshJwtSecret(),
      process.env.JWT_REFRESH_EXPIRE || '30d'
    );

    return { accessToken, refreshToken };
  }

  /**
   * REGISTER - Create new user
   * Maps to FE Register.jsx: formData { fullName, email, phone, password, confirmPassword }
   * and selectedRole ('farmer' | 'enterprise')
   */
  static async register(
    body: RegisterBody
  ): Promise<
    | { user: IUser; tokens: AuthTokens }
    | { requiresVerification: true; email: string; verificationUrl?: string }
  > {
    const { fullName, email, phone, password, confirmPassword, role, agreeTerms, province, district, ward } = body;

    AuthService.ensurePasswordsMatch(password, confirmPassword, 'Mật khẩu xác nhận không khớp');

    if (!isTruthy(agreeTerms)) {
      throw new AppError('Vui lòng đồng ý với điều khoản sử dụng', 400);
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (!existingUser.isVerified) {
        throw new AppError(
          'Email này đã đăng ký nhưng chưa xác minh. Vui lòng kiểm tra hộp thư để kích hoạt tài khoản.',
          400
        );
      }
      throw new AppError('Email đã được sử dụng', 400);
    }

    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        throw new AppError('Số điện thoại đã được sử dụng', 400);
      }
    }

    const { firstName, lastName } = parseFullName(fullName);

    const user = await User.create({
      email: email.toLowerCase(),
      password,
      role,
      firstName,
      lastName,
      fullName: fullName.trim(),
      phone,
      isVerified: false,
      ...(province && { province }),
      ...(district && { district }),
      ...(ward && { ward }),
    });

    // Both farmers and enterprises must verify their email before logging in.
    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    let verificationUrl: string | undefined;
    try {
      verificationUrl = await sendVerificationEmail(user.email, user.fullName, verificationToken);
    } catch (err) {
      log.error('Failed to send verification email after registration', err);
      verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    }

    return { requiresVerification: true as const, email: user.email, verificationUrl };
  }

  /**
   * LOGIN - Authenticate user
   * Maps to FE Auth.jsx: formData { emailOrPhone, password, rememberMe }
   * emailOrPhone can be email or phone number
   */
  static async login(body: LoginBody): Promise<{ user: IUser; tokens: AuthTokens }> {
    const { emailOrPhone, password, rememberMe } = body;

    if (!emailOrPhone || !password) {
      throw new AppError('Vui lòng nhập email/số điện thoại và mật khẩu', 400);
    }

    const isEmail = emailOrPhone.includes('@');
    const query = isEmail
      ? { email: emailOrPhone.toLowerCase() }
      : { phone: emailOrPhone };

    const user = await User.findOne(query).select(
      '+password +refreshToken +loginAttempts +lockUntil'
    );

    if (!user) {
      throw new AppError('Email/Số điện thoại hoặc mật khẩu không đúng', 401);
    }

    if (!user.isActive) {
      throw new AppError('Tài khoản đã bị vô hiệu hóa. Liên hệ hỗ trợ.', 403);
    }

    // Block Google-only accounts from password login
    if (user.authProvider === 'google') {
      throw new AppError('Tài khoản này đăng nhập bằng Google. Vui lòng dùng nút "Đăng nhập bằng Google".', 400);
    }

    if (!user.isVerified) {
      throw new AppError(
        'Email chưa được xác minh. Vui lòng kiểm tra hộp thư và nhấn link kích hoạt trước khi đăng nhập.',
        403
      );
    }

    if (process.env.NODE_ENV === 'production' && user.isLocked()) {
      throw new AppError(
        'Tài khoản đã bị khóa tạm thời do đăng nhập sai nhiều lần. Vui lòng thử lại sau 15 phút.',
        423
      );
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      if (process.env.NODE_ENV === 'production') {
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        }
        await user.save({ validateBeforeSave: false });

        const remainingAttempts = MAX_LOGIN_ATTEMPTS - user.loginAttempts;
        if (remainingAttempts > 0) {
          throw new AppError(
            `Email/Số điện thoại hoặc mật khẩu không đúng. Còn ${remainingAttempts} lần thử.`,
            401
          );
        }

        throw new AppError(
          'Tài khoản đã bị khóa tạm thời do đăng nhập sai nhiều lần.',
          423
        );
      }

      throw new AppError('Email/Số điện thoại hoặc mật khẩu không đúng', 401);
    }

    const tokens = AuthService.generateTokens(user);

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    AuthService.hideSensitiveFields(user);

    return { user, tokens };
  }

  /**
   * LOGOUT - Invalidate refresh token
   */
  static async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      refreshToken: undefined,
    });
  }

  /**
   * REFRESH TOKEN - Generate new access token from refresh token
   */
  static async refreshToken(token: string): Promise<AuthTokens> {
    if (!token) {
      throw new AppError('Refresh token is required', 400);
    }

    const decoded = AuthService.parseRefreshToken(token);

    // Find user with matching refresh token
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Generate new tokens
    const tokens = AuthService.generateTokens(user);

    // Update refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    return tokens;
  }

  /**
   * FORGOT PASSWORD - Generate reset token and return it
   * In production: send via email. Here we return the token in response.
   */
  static async forgotPassword(
    body: ForgotPasswordBody
  ): Promise<{ resetToken?: string; message: string }> {
    const { email } = body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản với email này', 404);
    }

    if (!user.isActive) {
      throw new AppError('Tài khoản đã bị vô hiệu hóa', 403);
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send password reset email via nodemailer
    const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const smtpConfig = getSmtpConfig(true);

    if (smtpConfig) {
      try {
        await sendEmail(
          smtpConfig,
          user.email,
          '[PreOnic] Đặt lại mật khẩu của bạn',
          buildPasswordResetEmailHtml(user.fullName, resetURL)
        );
      } catch {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        throw new AppError('Không thể gửi email. Vui lòng thử lại sau.', 500);
      }
    }

    return {
      resetToken: smtpConfig ? undefined : resetToken,
      message: smtpConfig
        ? 'Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.'
        : 'Token đặt lại mật khẩu đã được tạo. Token có hiệu lực trong 10 phút.',
    };
  }

  /**
   * RESET PASSWORD - Set new password using reset token
   */
  static async resetPassword(body: ResetPasswordBody): Promise<IUser> {
    const { token, password, confirmPassword } = body;

    AuthService.ensurePasswordsMatch(password, confirmPassword, 'Mật khẩu xác nhận không khớp');
    AuthService.ensurePasswordLength(password, 'Mật khẩu');

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      throw new AppError(
        'Token không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới.',
        400
      );
    }

    // Update password and clear reset fields
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    await user.save();

    return user;
  }

  /**
   * UPDATE PASSWORD - Change password for authenticated user
   */
  static async updatePassword(
    userId: string,
    body: UpdatePasswordBody
  ): Promise<{ user: IUser; tokens: AuthTokens }> {
    const { currentPassword, newPassword, confirmNewPassword } = body;

    AuthService.ensurePasswordsMatch(newPassword, confirmNewPassword, 'Mật khẩu mới xác nhận không khớp');
    AuthService.ensurePasswordLength(newPassword, 'Mật khẩu mới');

    if (currentPassword === newPassword) {
      throw new AppError('Mật khẩu mới không được trùng với mật khẩu hiện tại', 400);
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    const isCorrect = await user.comparePassword(currentPassword);
    if (!isCorrect) {
      throw new AppError('Mật khẩu hiện tại không đúng', 401);
    }

    user.password = newPassword;
    await user.save();

    const tokens = AuthService.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    AuthService.hideSensitiveFields(user);

    return { user, tokens };
  }

  /**
   * GET ME - Get current user profile
   */
  static async getMe(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }
    return user;
  }

  /**
   * UPDATE PROFILE - Update user profile info (not password)
   */
  static async updateProfile(
    userId: string,
    body: UpdateProfileBody
  ): Promise<IUser> {
    const updateData = AuthService.buildProfileUpdateData(body);

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    return user;
  }

  /**
   * DEACTIVATE ACCOUNT - Soft delete
   */
  static async deactivateAccount(userId: string): Promise<void> {
    const user = await User.findByIdAndUpdate(userId, {
      isActive: false,
      refreshToken: undefined,
    });

    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }
  }

  /**
   * VERIFY EMAIL - Confirm email address with token from link
   */
  static async verifyEmail(token: string): Promise<IUser> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      throw new AppError('Link xác minh không hợp lệ hoặc đã hết hạn.', 400);
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return user;
  }

  /**
   * GOOGLE LOGIN - Đăng nhập/đăng ký bằng Google.
   * Tài khoản Google luôn mặc định role = farmer; không hỗ trợ tạo enterprise qua Google.
   * Tài khoản tạo qua Google được xác minh ngay (không gửi email verify).
   */
  static async googleLogin(
    body: GoogleLoginBody
  ): Promise<{ user: IUser; tokens: AuthTokens }> {
    const { accessToken, credential } = body;

    if (!accessToken && !credential) {
      throw new AppError('Google token không hợp lệ', 400);
    }

    // Resolve Google user info
    let googleEmail: string;
    let googleName: string;
    let googlePicture: string | undefined;
    let googleSub: string;

    if (credential) {
      const { OAuth2Client } = require('google-auth-library');
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      type GoogleTicket = { getPayload: () => { email?: string; name?: string; picture?: string; sub?: string } };
      let ticket: GoogleTicket | null = null;
      try {
        ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        }) as GoogleTicket;
      } catch {
        throw new AppError('Google ID token không hợp lệ', 401);
      }
      if (!ticket) {
        throw new AppError('Google ID token không hợp lệ', 401);
      }
      const payload = ticket.getPayload();
      if (!payload?.email || !payload?.sub) {
        throw new AppError('Google trả thiếu thông tin cần thiết', 401);
      }
      googleEmail = payload.email;
      googleName = payload.name || payload.email;
      googlePicture = payload.picture;
      googleSub = payload.sub;
    } else {
      const axios = require('axios');
      try {
        const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        googleEmail = data.email;
        googleName = data.name || data.email;
        googlePicture = data.picture;
        googleSub = data.sub;
      } catch {
        throw new AppError('Không thể xác thực token Google', 401);
      }
    }

    if (!googleEmail) {
      throw new AppError('Không lấy được email từ Google', 400);
    }

    // Tìm user theo googleId hoặc email
    let user = await User.findOne({
      $or: [{ googleId: googleSub }, { email: googleEmail.toLowerCase() }],
    }).select('+googleId');

    if (!user) {
      // Tạo tài khoản farmer mới — đăng nhập thẳng, không qua xác minh email.
      const { firstName, lastName } = parseFullName(googleName);
      user = await User.create({
        email: googleEmail.toLowerCase(),
        password: crypto.randomBytes(32).toString('hex'),
        role: 'farmer',
        firstName,
        lastName,
        fullName: googleName.trim(),
        avatar: googlePicture,
        googleId: googleSub,
        authProvider: 'google',
        isVerified: true,
      });
    } else {
      // User đã tồn tại — chặn nếu là tài khoản doanh nghiệp đã đăng ký bằng đường thường,
      // tránh trường hợp doanh nghiệp lách qua Google để bỏ bước xác minh.
      if (user.role === 'enterprise') {
        throw new AppError(
          'Tài khoản doanh nghiệp không được phép đăng nhập bằng Google. Vui lòng dùng email và mật khẩu.',
          403
        );
      }
      if (!user.googleId) {
        user.googleId = googleSub;
        if (googlePicture && !user.avatar) user.avatar = googlePicture;
        await user.save({ validateBeforeSave: false });
      }
      if (!user.isActive) {
        throw new AppError('Tài khoản đã bị vô hiệu hóa. Liên hệ hỗ trợ.', 403);
      }
    }

    const tokens = AuthService.generateTokens(user);
    user.lastLogin = new Date();
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    AuthService.hideSensitiveFields(user);
    return { user, tokens };
  }

  /**
   * RESEND VERIFICATION EMAIL - Generate new token and send email
   */
  static async resendVerificationEmail(
    userId: string
  ): Promise<{ message: string }> {
    const user = await User.findById(userId).select('+emailVerificationToken +emailVerificationExpires');
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    if (user.isVerified) {
      throw new AppError('Tài khoản đã được xác minh email rồi.', 400);
    }

    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    await sendVerificationEmail(user.email, user.fullName, verificationToken);

    return { message: 'Email xác minh đã được gửi lại. Vui lòng kiểm tra hộp thư.' };
  }

}
