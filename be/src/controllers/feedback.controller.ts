import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler } from '../middlewares/error.middleware';
import { successResponse } from '../utils/response.util';
import { FeedbackService } from '../services/feedback.service';
import { FeedbackStatus } from '../models/Feedback.model';

// User (farmer/enterprise) gửi phản hồi hệ thống.
export const createFeedback = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    if (req.user!.role === 'admin') {
      res.status(403).json(successResponse({}, 'Admin không gửi phản hồi hệ thống'));
      return;
    }

    const feedback = await FeedbackService.create({
      userId: req.user!.id,
      userRole: req.user!.role as 'farmer' | 'enterprise',
      userName: req.user!.fullName,
      userEmail: req.user!.email,
      category: req.body.category,
      subject: req.body.subject,
      message: req.body.message,
    });

    res
      .status(201)
      .json(successResponse({ feedback }, 'Đã gửi phản hồi đến quản trị viên. Cảm ơn bạn!'));
  }
);

export const getMyFeedbacks = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const feedbacks = await FeedbackService.getMine(req.user!.id);
    res.status(200).json(successResponse({ feedbacks }));
  }
);

// ===== Admin =====

export const adminGetFeedbacks = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { status, category, role, page, limit } = req.query;
    const result = await FeedbackService.adminList({
      status: status as string,
      category: category as string,
      role: role as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json({
      success: true,
      status: 'success',
      data: result.items,
      unresolved: result.unresolved,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  }
);

export const adminUpdateFeedbackStatus = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const feedback = await FeedbackService.adminUpdateStatus(
      req.params.id,
      req.body.status as FeedbackStatus,
      req.body.adminNote
    );
    res.status(200).json(successResponse({ feedback }, 'Đã cập nhật phản hồi'));
  }
);
