import api from './api';

// Cache trong module: chỉ fetch lần đầu, các call sau dùng lại object đã lưu.
let provinceCoordsCache = null;
let provinceCoordsPromise = null;

const weatherService = {
  // Lấy bảng toạ độ tỉnh từ BE (source of truth chung). Cache trong session để tránh request lặp.
  getProvinceCoords: async () => {
    if (provinceCoordsCache) return provinceCoordsCache;
    if (provinceCoordsPromise) return provinceCoordsPromise;
    provinceCoordsPromise = api.get('/weather/provinces')
      .then(res => {
        provinceCoordsCache = res?.data?.data || {};
        return provinceCoordsCache;
      })
      .catch(() => ({}))
      .finally(() => { provinceCoordsPromise = null; });
    return provinceCoordsPromise;
  },
  /**
   * Get current weather for logged-in user's location
   */
  getCurrentWeather: async (province) => {
    try {
      const params = province ? { province } : {};
      const response = await api.get('/weather/current', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy thời tiết thất bại' };
    }
  },

  getForecast: async (province) => {
    try {
      const params = province ? { province } : {};
      const response = await api.get('/weather/forecast', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy dự báo thất bại' };
    }
  },

  /**
   * Get weather alerts for logged-in user
   */
  getAlerts: async (page = 1, limit = 20) => {
    try {
      const response = await api.get('/weather/alerts', { params: { page, limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy cảnh báo thời tiết thất bại' };
    }
  },

  /**
   * Get unread alert count
   */
  getUnreadAlertCount: async () => {
    try {
      const response = await api.get('/weather/alerts/unread-count');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy số cảnh báo chưa đọc thất bại' };
    }
  },

  /**
   * Mark a weather alert as read
   */
  markAlertAsRead: async (alertId) => {
    try {
      const response = await api.patch(`/weather/alerts/${alertId}/read`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Đánh dấu cảnh báo thất bại' };
    }
  },

  /**
   * Mark all weather alerts as read
   */
  markAllAlertsAsRead: async () => {
    try {
      const response = await api.patch('/weather/alerts/read-all');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Đánh dấu tất cả cảnh báo thất bại' };
    }
  },

  /**
   * Get weather thresholds
   */
  getThresholds: async () => {
    try {
      const response = await api.get('/weather/thresholds');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy ngưỡng cảnh báo thất bại' };
    }
  },
};

export default weatherService;
