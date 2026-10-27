import api from './api';

/**
 * Notification Service - Handle notification API calls
 */
const notificationService = {
  /**
   * Get notifications for logged-in user
   */
  getNotifications: async (page = 1, limit = 20) => {
    try {
      const response = await api.get('/notifications', { params: { page, limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy thông báo thất bại' };
    }
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy số thông báo chưa đọc thất bại' };
    }
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (notificationId) => {
    try {
      const response = await api.patch(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Đánh dấu thông báo thất bại' };
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async () => {
    try {
      const response = await api.patch('/notifications/read-all');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Đánh dấu tất cả thông báo thất bại' };
    }
  },
};

export default notificationService;
