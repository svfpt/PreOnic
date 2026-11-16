import api from './api';

const messagingService = {
  getConversations: async () => {
    const response = await api.get('/messaging/conversations');
    return response.data;
  },

  createConversation: async (partnerId, productId) => {
    const response = await api.post('/messaging/conversations', { partnerId, ...(productId ? { productId } : {}) });
    return response.data;
  },

  getConversationProducts: async (conversationId, params = {}) => {
    const response = await api.get(`/messaging/conversations/${conversationId}/products`, { params });
    return response.data;
  },

  attachProduct: async (conversationId, productId) => {
    const response = await api.post(`/messaging/conversations/${conversationId}/product`, { productId });
    return response.data;
  },

  getMessages: async (conversationId, options = {}) => {
    const response = await api.get(`/messaging/conversations/${conversationId}/messages`, {
      params: options,
    });
    return response.data;
  },

  markRead: async (conversationId, messageIds) => {
    const response = await api.post(`/messaging/conversations/${conversationId}/read`, { messageIds });
    return response.data;
  },

  getReceipts: async (conversationId, messageIds) => {
    const response = await api.post(`/messaging/conversations/${conversationId}/receipts`, { messageIds });
    return response.data;
  },

  setTyping: async (conversationId, typing) => {
    await api.post(`/messaging/conversations/${conversationId}/typing`, { typing });
  },

  removeAttachment: async (id) => {
    await api.delete(`/messaging/attachments/${id}`);
  },

  sendMessage: async (conversationId, text, attachments = []) => {
    const response = await api.post(`/messaging/conversations/${conversationId}/messages`, { text, attachments });
    return response.data;
  },

  uploadAttachment: async (conversationId, file) => {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post(`/messaging/conversations/${conversationId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  downloadAttachment: async (id) => {
    const response = await api.get(`/messaging/attachments/${id}`, { responseType: 'blob' });
    return response.data;
  },

  // Tổng số tin chưa đọc + các cuộc trò chuyện có tin mới (cho chuông Tin nhắn).
  getUnreadCount: async () => {
    const response = await api.get('/messaging/unread-count');
    return response.data;
  },
};

export default messagingService;
