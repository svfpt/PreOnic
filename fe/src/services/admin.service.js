/**
 * Admin Service — API calls for admin-only endpoints
 */
import api from './api';

const adminService = {
  // Dashboard
  getDashboard: async () => {
    const response = await api.get('/admin/dashboard');
    return response.data;
  },

  // User management
  getUsers: async (params = {}) => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  getUserDetail: async (id) => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  toggleUserStatus: async (id) => {
    const response = await api.patch(`/admin/users/${id}/toggle-status`);
    return response.data;
  },

  deleteUser: async (id) => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },

  // Contract management
  getContracts: async (params = {}) => {
    const response = await api.get('/admin/contracts', { params });
    return response.data;
  },

  getContractDetail: async (id) => {
    const response = await api.get(`/admin/contracts/${id}`);
    return response.data;
  },

  // Dispute management
  getDisputes: async (params = {}) => {
    const response = await api.get('/admin/disputes', { params });
    return response.data;
  },

  getDisputeDetail: async (id) => {
    const response = await api.get(`/admin/disputes/${id}`);
    return response.data;
  },

  resolveDispute: async (id, resolution, adminNotes) => {
    const response = await api.post(`/admin/disputes/${id}/resolve`, {
      resolution,
      adminNotes,
    });
    return response.data;
  },

  // Transactions
  getTransactions: async (params = {}) => {
    const response = await api.get('/admin/transactions', { params });
    return response.data;
  },

  // Withdrawal requests
  getWithdrawals: async (params = {}) => {
    const response = await api.get('/admin/withdrawals', { params });
    return response.data;
  },

  completeWithdrawal: async (id, adminNote = '') => {
    const response = await api.patch(`/admin/withdrawals/${id}/complete`, { adminNote });
    return response.data;
  },

  rejectWithdrawal: async (id, adminNote = '') => {
    const response = await api.patch(`/admin/withdrawals/${id}/reject`, { adminNote });
    return response.data;
  },

  // System feedback
  getFeedbacks: async (params = {}) => {
    const response = await api.get('/admin/feedback', { params });
    return response.data;
  },

  updateFeedbackStatus: async (id, status, adminNote = '') => {
    const response = await api.patch(`/admin/feedback/${id}/status`, { status, adminNote });
    return response.data;
  },
};

export default adminService;
