import { createHmac, randomInt } from 'crypto';
import User from '../models/User.model';
import { AppError } from '../middlewares/error.middleware';
import { getRegistrationEmailConfig, sendRegistrationOtp } from './email.service';

const EXPIRY_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
export const OTP_INFO = { expiresInSeconds: EXPIRY_MS / 1000, resendAfterSeconds: COOLDOWN_MS / 1000 };

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || value.length > 254) {
    throw new AppError('Địa chỉ email không hợp lệ', 400);
  }
  return value.trim().toLowerCase();
}
function hashOtp(email: string, otp: string): string {
  if (!process.env.JWT_SECRET) throw new AppError('Máy chủ chưa cấu hình bảo mật OTP', 503);
  return createHmac('sha256', process.env.JWT_SECRET).update(`email-verification:${email}:${otp}`).digest('hex');
}

export class EmailOtpService {
  static ensureDeliveryReady() {
    getRegistrationEmailConfig();
    if (!process.env.JWT_SECRET) throw new AppError('Máy chủ chưa cấu hình bảo mật OTP', 503);
  }

  static async send(emailValue: unknown) {
    const email = normalizeEmail(emailValue);
    this.ensureDeliveryReady();
    const now = new Date();
    const windowExpired = { $lte: [{ $ifNull: ['$emailOtpWindowAt', new Date(0)] }, new Date(now.getTime() - WINDOW_MS)] };
    const otp = randomInt(0, 1000000).toString().padStart(6, '0');
    const hash = hashOtp(email, otp);
    const user = await User.findOneAndUpdate({ email, isVerified: false, isActive: true, isHidden: { $ne: true },
      $and: [
        { $or: [{ emailOtpSentAt: { $exists: false } }, { emailOtpSentAt: { $lte: new Date(now.getTime() - COOLDOWN_MS) } }] },
        { $or: [{ emailOtpWindowAt: { $exists: false } }, { emailOtpWindowAt: { $lte: new Date(now.getTime() - WINDOW_MS) } }, { emailOtpSendCount: { $lt: 5 } }] },
      ],
    }, [{ $set: {
      emailOtpHash: hash, emailOtpExpiresAt: new Date(now.getTime() + EXPIRY_MS), emailOtpSentAt: now, emailOtpAttempts: 0,
      emailOtpSendCount: { $cond: [windowExpired, 1, { $add: [{ $ifNull: ['$emailOtpSendCount', 0] }, 1] }] },
      emailOtpWindowAt: { $cond: [windowExpired, now, '$emailOtpWindowAt'] },
      __v: { $add: [{ $ifNull: ['$__v', 0] }, 1] },
    } }, { $unset: ['emailVerificationToken', 'emailVerificationExpires'] }], { new: true });
    // Same response for unknown, already verified, throttled and eligible addresses.
    if (!user) return { ...OTP_INFO };
    try { await sendRegistrationOtp(user.email, user.fullName, otp); }
    catch {
      await User.updateOne({ _id: user._id, emailOtpHash: hash }, { $unset: { emailOtpHash: '', emailOtpExpiresAt: '' }, $inc: { __v: 1 } });
      throw new AppError('Không gửi được email OTP. Vui lòng thử gửi lại sau một phút.', 503);
    }
    return { ...OTP_INFO };
  }

  static async verify(emailValue: unknown, otp: unknown) {
    const email = normalizeEmail(emailValue);
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) throw new AppError('OTP phải gồm 6 chữ số', 400);
    const hash = hashOtp(email, otp);
    const filter = { email, isVerified: false, isActive: true, isHidden: { $ne: true },
      emailOtpExpiresAt: { $gt: new Date() }, emailOtpAttempts: { $lt: MAX_ATTEMPTS } };
    const user = await User.findOneAndUpdate({ ...filter, emailOtpHash: hash }, {
      $set: { isVerified: true },
      $unset: { emailOtpHash: '', emailOtpExpiresAt: '', emailOtpSentAt: '', emailOtpAttempts: '',
        emailOtpWindowAt: '', emailOtpSendCount: '', emailVerificationToken: '', emailVerificationExpires: '', refreshToken: '' },
      $inc: { __v: 1 },
    }, { new: true });
    if (user) return user;
    await User.updateOne({ ...filter, emailOtpHash: { $exists: true, $ne: hash } }, { $inc: { emailOtpAttempts: 1, __v: 1 } });
    throw new AppError('OTP không đúng, đã hết hạn hoặc đã quá số lần thử. Vui lòng yêu cầu mã mới.', 400);
  }
}
