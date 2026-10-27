import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller';

const router = Router();

// All notification routes require authentication
router.use(protect);

// ===== NOTIFICATIONS =====
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

export default router;
