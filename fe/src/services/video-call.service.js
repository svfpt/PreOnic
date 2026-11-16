import api, { API_URL } from './api';
import { STORAGE_KEYS } from '../constants';

const videoCallService = {
  config: async () => (await api.get('/messaging/calls/config')).data.data,
  current: async () => (await api.get('/messaging/calls/current')).data.data,
  get: async id => (await api.get(`/messaging/calls/${id}`)).data.data,
  start: async (conversationId, sessionId) => (await api.post(`/messaging/conversations/${conversationId}/calls`, { sessionId })).data.data,
  accept: async (id, sessionId) => (await api.post(`/messaging/calls/${id}/accept`, { sessionId })).data.data,
  end: async (id, sessionId, reason) => api.post(`/messaging/calls/${id}/end`, { sessionId, reason }),
  heartbeat: async (id, sessionId) => api.post(`/messaging/calls/${id}/heartbeat`, { sessionId }),
  signal: async (id, sessionId, kind, payload) => api.post(`/messaging/calls/${id}/signals`, { sessionId, kind, payload }),
  endOnUnload: (id, sessionId) => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;
    fetch(`${API_URL}/messaging/calls/${id}/end`, { method: 'POST', keepalive: true, credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, reason: 'ended' }),
    }).catch(() => undefined);
  },
};
export default videoCallService;
