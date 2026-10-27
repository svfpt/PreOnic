import api from './api';

/**
 * Contract Service - Handle contract API calls
 */
const contractService = {
  /**
   * Create a new contract
   */
  create: async (data) => {
    try {
      const response = await api.post('/contracts', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Tạo hợp đồng thất bại' };
    }
  },

  /**
   * List user's contracts
   */
  list: async (status) => {
    try {
      const params = status ? { status } : {};
      const response = await api.get('/contracts', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy danh sách hợp đồng thất bại' };
    }
  },

  /**
   * Get contract by ID
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/contracts/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy hợp đồng thất bại' };
    }
  },

  /**
   * Request OTP for signing (enterprise only)
   */
  requestSignOtp: async (id) => {
    try {
      const response = await api.post(`/contracts/${id}/request-sign-otp`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Gửi mã OTP thất bại' };
    }
  },

  /**
   * Sign a contract. Enterprise must supply otp; farmer can omit it.
   */
  sign: async (id, otp) => {
    try {
      const body = otp ? { otp } : {};
      const response = await api.post(`/contracts/${id}/sign`, body);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Ký hợp đồng thất bại' };
    }
  },

  /**
   * Cancel a contract
   */
  cancel: async (id, reason) => {
    try {
      const response = await api.post(`/contracts/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Hủy hợp đồng thất bại' };
    }
  },

  /**
   * Reject a contract (farmer rejects before signing)
   */
  reject: async (id, reason) => {
    try {
      const response = await api.post(`/contracts/${id}/reject`, { reason });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Từ chối hợp đồng thất bại' };
    }
  },
};

export default contractService;
