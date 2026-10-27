/**
 * Farmer Dashboard Service — API calls for farmer-specific endpoints
 */
import api from './api';

const farmerService = {
  getDashboard: async () => {
    const response = await api.get('/farmer/dashboard');
    return response.data;
  },

  getContracts: async (status) => {
    const params = status ? { status } : {};
    const response = await api.get('/farmer/contracts', { params });
    return response.data;
  },

  getCrops: async () => {
    const response = await api.get('/farmer/crops');
    return response.data;
  },

  getOrders: async (status) => {
    const params = status ? { status } : {};
    const response = await api.get('/farmer/orders', { params });
    return response.data;
  },

  getFinances: async () => {
    const response = await api.get('/farmer/finances');
    return response.data;
  },
};

export default farmerService;
