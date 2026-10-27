import api from './api';

const partnerRatingService = {
  getEligiblePartners: async () => {
    const response = await api.get('/partner-ratings/eligible-partners');
    return response.data;
  },

  getMyRatings: async () => {
    const response = await api.get('/partner-ratings/mine');
    return response.data;
  },

  createRating: async (payload) => {
    const response = await api.post('/partner-ratings', payload);
    return response.data;
  },
};

export default partnerRatingService;
