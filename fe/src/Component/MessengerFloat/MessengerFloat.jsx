import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMessageSquare, FiX, FiMaximize2 } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useMessenger } from '../../contexts/MessengerContext';
import { ROUTES } from '../../constants';
import messagingService from '../../services/messaging.service';
import { subscribeMessaging } from '../../services/messaging-events';
import Messaging from '../Messaging/Messaging';
import './MessengerFloat.css';

function MessengerSession() {
  const navigate = useNavigate();
  const { open, hasOpened, target, toggle, close } = useMessenger();
  const [total, setTotal] = useState(0);
  const [bounce, setBounce] = useState(false);
  const activeChatRef = useRef(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const previousTotalRef = useRef(null);
  const bounceTimerRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    let request = 0;
    const load = async () => {
      const current = ++request;
      try {
        const response = await messagingService.getUnreadCount();
        if (stopped || current !== request) return;
        const next = response?.data?.total || 0;
        setTotal(next);
        if (previousTotalRef.current !== null && next > previousTotalRef.current) {
          setBounce(true);
          clearTimeout(bounceTimerRef.current);
          bounceTimerRef.current = setTimeout(() => setBounce(false), 1200);
        }
        previousTotalRef.current = next;
      } catch { /* retain the last known count while reconnecting */ }
    };
    void load();
    const unsubscribe = subscribeMessaging(event => {
      if (['connected', 'message', 'read'].includes(event.type)) void load();
    });
    const interval = setInterval(load, 30000);
    return () => { stopped = true; clearInterval(interval); clearTimeout(bounceTimerRef.current); unsubscribe(); };
  }, []);

  const rememberChat = useCallback(id => { activeChatRef.current = id; }, []);

  useEffect(() => {
    if (!open) return undefined;
    const outside = event => {
      if (event.target.closest?.('[data-messenger-dialog], .modal-backdrop')) return;
      if (!panelRef.current?.contains(event.target)) close();
    };
    const escape = event => {
      if (event.key === 'Escape' && !document.querySelector('[data-messenger-dialog].show')) {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open, close]);

  const expand = () => {
    const chat = activeChatRef.current;
    navigate(chat ? `${ROUTES.MESSAGING}?conversationId=${encodeURIComponent(chat)}` : ROUTES.MESSAGING);
    close();
  };

  return <div className="mf-root" ref={panelRef}>
    {hasOpened && <section id="messenger-floating-panel" className="mf-panel" aria-label="Tin nhắn nhanh" hidden={!open}>
      <div className="mf-panel-header">
        <div className="mf-panel-title"><FiMessageSquare size={16} /><span>Tin nhắn</span>
          {total > 0 && <span className="mf-panel-badge">{total}</span>}
        </div>
        <div className="mf-panel-actions">
          <button className="mf-view-all-btn" onClick={expand} title="Mở trang tin nhắn đầy đủ"><FiMaximize2 size={13} /> Xem tất cả</button>
          <button className="mf-close-btn" aria-label="Thu nhỏ tin nhắn" onClick={() => { close(); triggerRef.current?.focus(); }}><FiX size={17} /></button>
        </div>
      </div>
      <div className="mf-panel-body">
        <Messaging embedded visible={open} target={target} onActiveChatChange={rememberChat} onNavigateAway={close} />
      </div>
    </section>}
    <button ref={triggerRef} className={`mf-trigger ${bounce ? 'mf-bounce' : ''}`}
      onClick={toggle}
      title="Tin nhắn" aria-label="Mở tin nhắn" aria-expanded={open} aria-controls="messenger-floating-panel">
      <FiMessageSquare size={24} />
      {total > 0 && <span className="mf-trigger-badge" aria-label={`${total} tin nhắn chưa đọc`}>{total > 99 ? '99+' : total}</span>}
    </button>
  </div>;
}

export default function MessengerFloat() {
  const { user } = useAuth();
  if (!user || !['farmer', 'enterprise'].includes(user.role)) return null;
  return <MessengerSession key={user._id || user.id} />;
}
