/**
 * Enterprise Dashboard Service — API calls for enterprise-specific endpoints
 */
import api from './api';

const enterpriseService = {
  getDashboard: async () => {
    const response = await api.get('/enterprise/dashboard');
    return response.data;
  },

  getContracts: async (status) => {
    const params = status ? { status } : {};
    const response = await api.get('/enterprise/contracts', { params });
    return response.data;
  },

  getSuppliers: async () => {
    const response = await api.get('/enterprise/suppliers');
    return response.data;
  },

  getWarehouse: async () => {
    const response = await api.get('/enterprise/warehouse');
    return response.data;
  },

  getAnalytics: async () => {
    const response = await api.get('/enterprise/analytics');
    return response.data;
  },

  getOrders: async (status) => {
    const params = status ? { status } : {};
    const response = await api.get('/enterprise/orders', { params });
    return response.data;
  },
};

export default enterpriseService;
