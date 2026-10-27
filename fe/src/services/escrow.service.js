import api from './api';

/**
 * Escrow Service - Handle escrow / payment intermediary API calls
 */
const escrowService = {
  /**
   * Get user's virtual balance
   */
  getBalance: async () => {
    try {
      const response = await api.get('/escrow/balance');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy số dư thất bại' };
    }
  },

  /**
   * Create escrow for a contract
   */
  create: async (contractId) => {
    try {
      const response = await api.post('/escrow', { contractId });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Tạo escrow thất bại' };
    }
  },

  /**
   * List user's escrows
   */
  list: async () => {
    try {
      const response = await api.get('/escrow');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy danh sách escrow thất bại' };
    }
  },

  /**
   * Get escrow details by ID
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/escrow/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy thông tin escrow thất bại' };
    }
  },

  /**
   * Get escrow by contract ID
   */
  getByContract: async (contractId) => {
    try {
      const response = await api.get(`/escrow/contract/${contractId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy escrow thất bại' };
    }
  },

  /**
   * Enterprise deposits money into escrow
   */
  deposit: async (escrowId, amount) => {
    try {
      const response = await api.post(`/escrow/${escrowId}/deposit`, { amount });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Đặt cọc thất bại' };
    }
  },

  /**
   * Farmer confirms a milestone
   */
  farmerConfirm: async (escrowId, milestoneStep, evidence) => {
    try {
      const response = await api.post(`/escrow/${escrowId}/farmer-confirm`, {
        milestoneStep,
        evidence,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Xác nhận thất bại' };
    }
  },

  /**
   * Enterprise confirms a milestone
   */
  enterpriseConfirm: async (escrowId, milestoneStep, evidence) => {
    try {
      const response = await api.post(`/escrow/${escrowId}/enterprise-confirm`, {
        milestoneStep,
        evidence,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Xác nhận thất bại' };
    }
  },

  /**
   * Raise a dispute on a milestone
   */
  raiseDispute: async (escrowId, milestoneStep, reason, evidence) => {
    try {
      const response = await api.post(`/escrow/${escrowId}/dispute`, {
        milestoneStep,
        reason,
        evidence,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Tạo khiếu nại thất bại' };
    }
  },

  /**
   * List user's disputes
   */
  listDisputes: async () => {
    try {
      const response = await api.get('/escrow/disputes');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Lấy danh sách khiếu nại thất bại' };
    }
  },

  /**
   * Admin: Resolve a dispute
   */
  resolveDispute: async (disputeId, resolution, adminNotes) => {
    try {
      const response = await api.post(`/escrow/disputes/${disputeId}/resolve`, {
        resolution,
        adminNotes,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Giải quyết khiếu nại thất bại' };
    }
  },
};

export default escrowService;
