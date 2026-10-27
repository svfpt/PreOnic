/**
 * Feedback Service — phản hồi hệ thống (Nông dân / Doanh nghiệp gửi → Admin)
 * Kết nối BE /api/v1/feedback/*
 */
import api from './api';

const feedbackService = {
  /**
   * Gửi phản hồi hệ thống
   * @param {{ category?: string, subject: string, message: string }} data
   */
  submit: async (data) => {
    const response = await api.post('/feedback', data);
    return response.data;
  },

  /** Lấy các phản hồi đã gửi của chính người dùng */
  getMine: async () => {
    const response = await api.get('/feedback/mine');
    return response.data;
  },
};

export default feedbackService;
