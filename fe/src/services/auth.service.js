import api from './api';
import { STORAGE_KEYS } from '../constants';
import { API_URL } from './api';

const { ACCESS_TOKEN, USER } = STORAGE_KEYS;

// ===== HELPERS =====

/** Save auth data to localStorage after successful auth */
const persistAuth = (data) => {
  if (data?.accessToken) localStorage.setItem(ACCESS_TOKEN, data.accessToken);
  if (data?.user) localStorage.setItem(USER, JSON.stringify(data.user));
};

/** Clear all auth data from localStorage */
const clearAuth = () => {
  localStorage.removeItem(ACCESS_TOKEN);
  localStorage.removeItem(USER);
};

/** Extract a user-friendly error message from an API error */
const extractErrorMessage = (error, fallback) => {
  const errorData = error.response?.data;
  if (!errorData && error.request) {
    return {
      success: false,
      message: `Không thể kết nối tới máy chủ. Hãy kiểm tra backend đang chạy tại ${API_URL}.`,
    };
  }

  // Prefer specific validation errors over generic message
  const message = errorData?.errors?.[0] || errorData?.message || fallback;
  return { ...errorData, message };
};

/**
 * Auth Service - Handle all authentication related API calls
 */
const authService = {
  /**
   * Register a new user
   * @param {Object} data - { fullName, email, phone, password, confirmPassword, role }
   * @returns {Promise}
   */
  register: async (data) => {
    try {
      const response = await api.post('/auth/register', data);
      // Không tự đăng nhập sau khi đăng ký: user phải tự đăng nhập lại.
      // (Trước đây persist token ở đây khiến farmer bị nhảy thẳng vào dashboard.)
      return response.data;
    } catch (error) {
      throw extractErrorMessage(error, 'Đăng ký thất bại');
    }
  },

  /**
   * Login user
   * @param {Object} data - { emailOrPhone, password, rememberMe }
   * @returns {Promise}
   */
  login: async (data) => {
    try {
      const response = await api.post('/auth/login', data);
      if (response.data.success) persistAuth(response.data.data);
      return response.data;
    } catch (error) {
      throw extractErrorMessage(error, 'Đăng nhập thất bại');
    }
  },

  /**
   * Logout user
   * @returns {Promise}
   */
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Silently fail - we clear local data regardless
    } finally {
      clearAuth();
    }
  },

  /**
   * Refresh access token
   * @returns {Promise}
   */
  refreshToken: async () => {
    try {
      const response = await api.post('/auth/refresh-token');
      if (response.data.success) {
        localStorage.setItem(ACCESS_TOKEN, response.data.data.accessToken);
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Làm mới token thất bại' };
    }
  },

  /**
   * Forgot password - Send reset email
   * @param {Object} data - { email }
   * @returns {Promise}
   */
  forgotPassword: async (data) => {
    try {
      const response = await api.post('/auth/forgot-password', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Gửi email thất bại' };
    }
  },

  /**
   * Reset password with token
   * @param {Object} data - { token, password, confirmPassword }
   * @returns {Promise}
   */
  resetPassword: async (data) => {
    try {
      const response = await api.post('/auth/reset-password', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Đặt lại mật khẩu thất bại' };
    }
  },

  /**
   * Verify email address with token
   * @param {string} token - Verification token from URL
   * @returns {Promise}
   */
  verifyEmail: async (token) => {
    try {
      const response = await api.get(`/auth/verify-email/${token}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Xác minh email thất bại' };
    }
  },

  /**
   * Resend email verification link
   * @returns {Promise}
   */
  resendVerification: async () => {
    try {
      const response = await api.post('/auth/resend-verification');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Gửi lại email thất bại' };
    }
  },

  /**
   * Update password (when logged in)
   * @param {Object} data - { currentPassword, newPassword, confirmPassword }
   * @returns {Promise}
   */
  updatePassword: async (data) => {
    try {
      const response = await api.put('/auth/update-password', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Cập nhật mật khẩu thất bại' };
    }
  },

  /**
   * Get current user profile
   * @returns {Promise}
   */
  getMe: async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        localStorage.setItem(USER, JSON.stringify(response.data.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy thông tin thất bại' };
    }
  },

  /**
   * Update user profile
   * @param {Object} data - { fullName, phone, avatar, ... }
   * @returns {Promise}
   */
  updateProfile: async (data) => {
    try {
      const response = await api.put('/auth/update-profile', data);
      if (response.data.success) {
        localStorage.setItem(USER, JSON.stringify(response.data.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Cập nhật thông tin thất bại' };
    }
  },

  /**
   * Deactivate account
   * @returns {Promise}
   */
  deactivateAccount: async () => {
    try {
      const response = await api.delete('/auth/deactivate');
      if (response.data.success) clearAuth();
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Hủy tài khoản thất bại' };
    }
  },

  /**
   * Get current user from localStorage
   * @returns {Object|null}
   */
  getCurrentUser: () => {
    try {
      const userString = localStorage.getItem(USER);
      return userString ? JSON.parse(userString) : null;
    } catch {
      return null;
    }
  },

  /**
   * Login / register with Google OAuth
   * @param {Object} data - { accessToken?, credential?, role? }
   * @returns {Promise} - { success, requiresRole?, data: { profile? | user + accessToken } }
   */
  googleLogin: async (data) => {
    try {
      const response = await api.post('/auth/google', data);
      if (response.data.success && response.data.data?.accessToken) {
        persistAuth(response.data.data);
      }
      return response.data;
    } catch (error) {
      throw extractErrorMessage(error, 'Đăng nhập Google thất bại');
    }
  },

  isLoggedIn: () => !!localStorage.getItem(ACCESS_TOKEN),

  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN),
};

export default authService;
