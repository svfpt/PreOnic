import { useCallback, useSyncExternalStore } from 'react';

const cache = new Map();
const listeners = new Set();
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };

const snapshot = key => {
  let raw;
  try { raw = sessionStorage.getItem(key); } catch { raw = cache.get(key)?.raw || null; }
  if (cache.has(key) && cache.get(key).raw === raw) return cache.get(key).items;
  let items;
  try { items = JSON.parse(raw || '{}'); } catch { items = {}; }
  if (!items || typeof items !== 'object' || Array.isArray(items)) items = {};
  cache.set(key, { raw, items });
  return items;
};

const updateStore = (key, update) => {
  const previous = snapshot(key);
  const items = update(previous);
  if (items === previous) return;
  let raw = cache.get(key)?.raw || null;
  try { raw = JSON.stringify(items); sessionStorage.setItem(key, raw); }
  catch { raw = cache.get(key)?.raw || null; }
  cache.set(key, { raw, items });
  listeners.forEach(listener => listener());
};

export default function useMessageDrafts(userId, chatId) {
  const key = `messaging-drafts:${userId || 'guest'}`;
  // The page and the floating chat share one draft, including uploaded attachments.
  const getSnapshot = useCallback(() => snapshot(key), [key]);
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const draft = items[chatId] || {};
  const mergeAliases = useCallback(conversations => {
    updateStore(key, stored => {
      const next = { ...stored };
      let changed = false;
      conversations.forEach(conversation => {
        (conversation.aliases || []).forEach(alias => {
          if (!next[alias] || alias === conversation.id) return;
          const existing = next[conversation.id] || {};
          const legacy = next[alias];
          const text = [...new Set([existing.text, legacy.text].filter(Boolean))].join(' · ');
          const attachments = [...new Map([...(existing.attachments || []), ...(legacy.attachments || [])].map(file => [file._id, file])).values()];
          next[conversation.id] = { text, attachments };
          delete next[alias];
          changed = true;
        });
      });
      return changed ? next : stored;
    });
  }, [key]);
  const update = (field, value) => {
    updateStore(key, stored => {
      const current = stored[chatId] || {};
      const nextValue = typeof value === 'function' ? value(current[field] || (field === 'text' ? '' : [])) : value;
      return { ...stored, [chatId]: { ...current, [field]: nextValue } };
    });
  };
  return {
    mergeAliases,
    inputText: draft.text || '', attachments: draft.attachments || [],
    setInputText: value => update('text', value),
    setAttachments: value => update('attachments', value),
  };
}
