import api, { API_URL } from './api';
import { STORAGE_KEYS } from '../constants';

const listeners = new Set();
let controller;
let retryTimer;
let status = 'connecting';
const connection = value => {
  status = value;
  listeners.forEach(listener => listener({ type: 'connection', status }));
};

async function connect() {
  controller = new AbortController();
  const signal = controller.signal;
  try {
    const response = await fetch(`${API_URL}/messaging/events`, {
      headers: { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || ''}` },
      credentials: 'include', signal,
    });
    if (response.status === 401) {
      // The shared interceptor refreshes expired tokens before reconnecting.
      await api.get('/messaging/conversations');
      throw new Error('Reconnect with refreshed token');
    }
    if (!response.ok || !response.body) throw new Error('Stream unavailable');
    connection('connected');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const line = frame.split('\n').find((item) => item.startsWith('data: '));
        if (line) {
          const event = JSON.parse(line.slice(6));
          listeners.forEach((listener) => listener(event));
        }
      }
    }
  } catch {
    // Reconnect and resync persisted messages after temporary network failures.
  } finally {
    if (!signal.aborted && listeners.size) {
      connection('reconnecting');
      retryTimer = setTimeout(connect, 1500);
    }
  }
}

export function subscribeMessaging(listener) {
  listeners.add(listener);
  listener({ type: 'connection', status });
  if (listeners.size === 1) connect();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(retryTimer);
      controller?.abort();
      status = 'connecting';
    }
  };
}
