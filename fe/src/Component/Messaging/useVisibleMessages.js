import { useEffect } from 'react';
import messagingService from '../../services/messaging.service';

export default function useVisibleMessages(rootRef, chatId, messages, onRead, enabled = true) {
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root || !chatId || typeof IntersectionObserver === 'undefined') return undefined;
    let stopped = false;
    let timer;
    let busy = false;
    const visible = new Set();
    const acknowledged = new Set();
    const flush = async () => {
      if (document.visibilityState === 'hidden' || stopped || busy) return;
      const ids = [...visible].filter(id => !acknowledged.has(id)).slice(0, 100);
      if (!ids.length) return;
      busy = true;
      try {
        await messagingService.markRead(chatId, ids);
        ids.forEach(id => acknowledged.add(id));
        if (!stopped) onRead(chatId, ids);
      } catch { /* retry while these messages remain visible */ }
      finally { busy = false; if (!stopped) timer = setTimeout(flush, 2000); }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(flush, 150); };
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const id = entry.target.dataset.messageId;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) visible.add(id); else visible.delete(id);
      });
      schedule();
    }, { root, threshold: 0.25 });
    root.querySelectorAll('[data-unread="true"]').forEach(node => observer.observe(node));
    document.addEventListener('visibilitychange', schedule);
    return () => { stopped = true; clearTimeout(timer); observer.disconnect(); document.removeEventListener('visibilitychange', schedule); };
  }, [rootRef, chatId, messages, onRead, enabled]);
}
