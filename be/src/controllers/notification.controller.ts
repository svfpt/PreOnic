import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler } from '../middlewares/error.middleware';
import { NotificationService } from '../services/notification.service';
import { successResponse } from '../utils/response.util';

/**
 * @desc    Get notifications for logged-in user
 * @route   GET /api/v1/notifications
 * @access  Private
 */
export const getNotifications = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await NotificationService.getNotifications(req.user!.id, page, limit);
    res.status(200).json({
      success: true,
      status: 'success',
      data: result.notifications,
      unreadCount: result.unreadCount,
      pagination: result.pagination,
    });
  }
);

/**
 * @desc    Get unread notification count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private
 */
export const getUnreadCount = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const count = await NotificationService.getUnreadCount(req.user!.id);
    res.status(200).json(successResponse({ count }));
  }
);

/**
 * @desc    Mark a notification as read
 * @route   PATCH /api/v1/notifications/:id/read
 * @access  Private
 */
export const markAsRead = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const notification = await NotificationService.markAsRead(req.params.id, req.user!.id);
    res.status(200).json(successResponse(notification, 'Đã đánh dấu đã đọc'));
  }
);

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/v1/notifications/read-all
 * @access  Private
 */
export const markAllAsRead = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    await NotificationService.markAllAsRead(req.user!.id);
    res.status(200).json(successResponse(null, 'Đã đánh dấu tất cả đã đọc'));
  }
);
