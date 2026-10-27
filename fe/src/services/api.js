import axios from 'axios';
import { STORAGE_KEYS } from '../constants';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/v1';
const AUTH_REDIRECT_PATH = '/auth';
const PROFILE_REDIRECT_PATH = '/profile';
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const PROFILE_INCOMPLETE_CODE = 'PROFILE_INCOMPLETE';

const api = axios.create({
  baseURL: API_URL,
  // BE chạy Render Free → spin down khi idle, cold start có thể mất 30-50s.
  // Timeout 15s khiến request đầu tiên (vd: Campaigns ở homepage) fail trong lúc BE đang "ngủ dậy".
  // 45s đủ để vượt qua cold start; Render giữ kết nối và trả về khi server sẵn sàng.
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Tách các bước nhỏ thành helper để interceptor dễ đọc và dễ bảo trì hơn.
const attachAccessToken = (config) => {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
};

const clearStoredAuth = () => {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
};

const redirectToLogin = () => {
  if (window.location.pathname !== AUTH_REDIRECT_PATH) {
    window.location.href = AUTH_REDIRECT_PATH;
  }
};

// Shared promise to prevent concurrent refresh attempts (token rotation would invalidate the second call)
let _refreshing = null;

const refreshAccessToken = () => {
  if (_refreshing) return _refreshing;
  _refreshing = axios
    .post(`${API_URL}/auth/refresh-token`, {}, { withCredentials: true })
    .then((response) => {
      const { accessToken } = response.data?.data || {};
      if (!accessToken) throw new Error('Không nhận được access token mới từ máy chủ');
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      return accessToken;
    })
    .finally(() => { _refreshing = null; });
  return _refreshing;
};

// Attach access token to every request
api.interceptors.request.use(
  attachAccessToken,
  (error) => Promise.reject(error)
);

// Handle 401 errors with automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isUnauthorized = error.response?.status === UNAUTHORIZED_STATUS;
    const hasNotRetried = !originalRequest?._retry;
    const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh-token');

    // BE trả 403 + code PROFILE_INCOMPLETE → đẩy user về trang hồ sơ để bổ sung.
    if (
      error.response?.status === FORBIDDEN_STATUS &&
      error.response?.data?.code === PROFILE_INCOMPLETE_CODE &&
      window.location.pathname !== PROFILE_REDIRECT_PATH
    ) {
      window.location.href = `${PROFILE_REDIRECT_PATH}?incomplete=1`;
    }

    if (isUnauthorized && hasNotRetried && !isRefreshRequest) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        clearStoredAuth();
        redirectToLogin();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
