import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.model';
import { AuthRequest, JwtUserPayload } from '../types';
import { AppError } from './error.middleware';

const BEARER_PREFIX = 'Bearer ';

// Đọc token từ header theo đúng chuẩn Bearer để tránh lặp lại việc tách chuỗi.
const extractBearerToken = (authorizationHeader?: string): string | undefined => {
  if (!authorizationHeader?.startsWith(BEARER_PREFIX)) {
    return undefined;
  }

  return authorizationHeader.slice(BEARER_PREFIX.length).trim();
};

// Tách việc đọc secret ra helper riêng để lỗi cấu hình được báo rõ ràng hơn.
const getJwtSecret = (): string => {
  if (!process.env.JWT_SECRET) {
    throw new AppError('Máy chủ chưa cấu hình JWT_SECRET', 500);
  }

  return process.env.JWT_SECRET;
};

export const protect = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return next(new AppError('Bạn cần đăng nhập để truy cập tài nguyên này', 401));
  }

  try {
    // Luồng bảo vệ luôn kiểm tra lại người dùng trong DB để chặn tài khoản đã bị vô hiệu hóa.
    const decoded = jwt.verify(token, getJwtSecret()) as JwtUserPayload;
    const activeUser = await User.findById(decoded.id).select(
      'email role fullName isActive isHidden'
    );

    if (!activeUser || !activeUser.isActive || activeUser.isHidden) {
      return next(
        new AppError('Tài khoản không còn khả dụng hoặc đã bị vô hiệu hóa', 401)
      );
    }

    req.user = {
      id: String(activeUser._id),
      email: activeUser.email,
      role: activeUser.role,
      fullName: activeUser.fullName,
    };

    return next();
  } catch {
    return next(new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 401));
  }
};

/**
 * Yêu cầu user đã hoàn thiện hồ sơ cá nhân trước khi thao tác nghiệp vụ.
 * Trả về 403 + code 'PROFILE_INCOMPLETE' để FE chuyển hướng người dùng vào trang hồ sơ.
 */
export const requireCompleteProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Bạn cần đăng nhập để truy cập tài nguyên này', 401));
  }
  // Admin được miễn (tài khoản hệ thống)
  if (req.user.role === 'admin') return next();

  const fullUser = await User.findById(req.user.id);
  if (!fullUser) {
    return next(new AppError('Không tìm thấy người dùng', 404));
  }

  if (!fullUser.isProfileComplete()) {
    return res.status(403).json({
      success: false,
      status: 'error',
      code: 'PROFILE_INCOMPLETE',
      message: 'Vui lòng cập nhật đầy đủ hồ sơ cá nhân trước khi thực hiện thao tác này.',
    });
  }
  return next();
};

export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('Bạn không có quyền thực hiện thao tác này', 403)
      );
    }
    next();
  };
};
