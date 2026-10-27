import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/auth.service';
import { STORAGE_KEYS } from '../constants';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    try {
      if (authService.isLoggedIn()) {
        setUser(authService.getCurrentUser());
      }
    } catch {
      authService.logout();
    } finally {
      setLoading(false);
    }
  }, []);

  // Login: calls API, persists tokens, updates context state
  const login = useCallback(async (credentials) => {
    const response = await authService.login(credentials);
    if (response.success && response.data?.user) {
      setUser(response.data.user);
    }
    return response;
  }, []);

  // Register: chỉ tạo tài khoản, KHÔNG tự đăng nhập.
  // User sau khi đăng ký phải tự đăng nhập lại → không setUser ở đây.
  const register = useCallback(async (data) => {
    return authService.register(data);
  }, []);

  // Logout: calls API, clears tokens, clears context state
  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  // Update user state + localStorage (for post-login sync from components)
  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
    if (updatedUser) {
      // Safari private mode / vượt quota → ném SecurityError; nuốt để không gãy auth flow.
      try {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      } catch {
        // Bỏ qua: state vẫn cập nhật trong context, chỉ mất khả năng persist qua reload.
      }
    }
  }, []);

  const value = {
    user,
    loading,
    isLoggedIn: !!user,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
