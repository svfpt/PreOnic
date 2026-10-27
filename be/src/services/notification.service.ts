import Notification, { INotification } from '../models/Notification.model';
import User from '../models/User.model';
import { AppError } from '../middlewares/error.middleware';
import { NotificationType } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('Notification');

export class NotificationService {
  /**
   * Create an in-app notification
   */
  static async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
    relatedId?: string;
    relatedModel?: 'Contract' | 'Escrow' | 'WeatherAlert' | 'Dispute';
  }): Promise<INotification> {
    const notification = await Notification.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      severity: params.severity || 'info',
      relatedId: params.relatedId,
      relatedModel: params.relatedModel,
    });

    // Send email for critical notifications
    if (params.severity === 'critical') {
      await this.sendEmailNotification(params.userId, params.title, params.message);
    }

    return notification;
  }

  /**
   * Create weather alert notification for a user
   */
  static async createWeatherAlertNotification(
    userId: string,
    alertId: string,
    title: string,
    message: string,
    severity: 'warning' | 'critical'
  ): Promise<INotification> {
    return this.create({
      userId,
      type: 'weather_alert',
      title,
      message,
      severity,
      relatedId: alertId,
      relatedModel: 'WeatherAlert',
    });
  }

  /**
   * Get notifications for a user with pagination
   */
  static async getNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: string, userId: string) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );
    if (!notification) throw new AppError('Thông báo không tồn tại', 404);
    return notification;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string) {
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({ userId, isRead: false });
  }

  /**
   * Delete old notifications (older than 90 days)
   */
  static async cleanupOldNotifications(): Promise<number> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({
      createdAt: { $lt: ninetyDaysAgo },
      isRead: true,
    });
    return result.deletedCount;
  }

  /**
   * Send email notification for critical alerts
   * Uses nodemailer if configured, otherwise logs to console
   */
  private static async sendEmailNotification(
    userId: string,
    subject: string,
    body: string
  ): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user?.email) return;

      // Check if nodemailer is configured via env vars
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        // Dynamic import to avoid error if nodemailer not installed
        try {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: smtpUser, pass: smtpPass },
          });

          await transporter.sendMail({
            from: process.env.SMTP_FROM || '"PreOnic" <noreply@preonic.vn>',
            to: user.email,
            subject: `[PreOnic] ${subject}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #16a34a; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0;">PreOnic</h1>
                  <p style="margin: 5px 0 0;">Nen tang ket noi nong nghiep ben vung</p>
                </div>
                <div style="padding: 20px; background: #f9f9f9;">
                  <h2 style="color: #333;">${subject}</h2>
                  <p style="color: #555; line-height: 1.6;">${body}</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                  <p style="color: #999; font-size: 12px;">Day la email tu dong tu he thong PreOnic. Vui long khong tra loi email nay.</p>
                </div>
              </div>
            `,
          });

          // Mark that email was sent
          await Notification.findOneAndUpdate(
            { userId, relatedModel: 'WeatherAlert' },
            { emailSent: true }
          );
        } catch (emailErr) {
          log.error('Email send failed', emailErr);
        }
      } else {
        log.info(`[MOCK] To: ${user.email} | Subject: ${subject} | Body: ${body}`);
      }
    } catch (error) {
      log.error('Email notification error', error);
    }
  }
}
