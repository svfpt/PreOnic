import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FiMessageSquare, FiX, FiChevronRight } from "react-icons/fi";
import { ROUTES } from "../../constants";
import messagingService from "../../services/messaging.service";
import { formatDate } from "../../hooks/useApiData";
import "./MessengerFloat.css";

export default function MessengerFloat() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [bounce, setBounce] = useState(false);
  const prevTotal = useRef(0);
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await messagingService.getUnreadCount();
      if (res?.data) {
        const newTotal = res.data.total || 0;
        setConversations(res.data.conversations || []);
        setTotal(newTotal);
        if (newTotal > prevTotal.current && prevTotal.current >= 0) {
          setBounce(true);
          setTimeout(() => setBounce(false), 1200);
        }
        prevTotal.current = newTotal;
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const openConversation = (conversationId) => {
    setOpen(false);
    navigate(`${ROUTES.MESSAGING}?conversationId=${conversationId}`);
  };

  const openAllMessages = () => {
    setOpen(false);
    navigate(ROUTES.MESSAGING);
  };

  const roleLabel = (r) => r === "enterprise" ? "Doanh nghiệp" : "Nông dân";

  const initials = (name) => (name || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mf-root" ref={panelRef}>
      {/* Popup panel */}
      {open && (
        <div className="mf-panel">
          <div className="mf-panel-header">
            <div className="mf-panel-title">
              <FiMessageSquare size={16} />
              <span>Tin nhắn</span>
              {total > 0 && <span className="mf-panel-badge">{total}</span>}
            </div>
            <div className="mf-panel-actions">
              <button className="mf-view-all-btn" onClick={openAllMessages}>
                Xem tất cả <FiChevronRight size={13} />
              </button>
              <button className="mf-close-btn" onClick={() => setOpen(false)}>
                <FiX size={16} />
              </button>
            </div>
          </div>

          <div className="mf-panel-body">
            {conversations.length === 0 ? (
              <div className="mf-empty">
                <div className="mf-empty-icon">
                  <FiMessageSquare size={28} />
                </div>
                <p>Không có tin nhắn mới</p>
                <button className="mf-goto-btn" onClick={openAllMessages}>
                  Đến trang nhắn tin
                </button>
              </div>
            ) : (
              <div className="mf-conv-list">
                {conversations.map((c) => (
                  <button
                    key={c.conversationId}
                    className="mf-conv-item"
                    onClick={() => openConversation(c.conversationId)}
                  >
                    <div className="mf-avatar">
                      {initials(c.partnerName)}
                      {c.unreadCount > 0 && (
                        <span className="mf-avatar-badge">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="mf-conv-info">
                      <div className="mf-conv-top">
                        <span className="mf-conv-name">{c.partnerName}</span>
                        <span className="mf-conv-role">{roleLabel(c.partnerRole)}</span>
                      </div>
                      <p className="mf-conv-msg">{c.lastMessage || "Tin nhắn mới"}</p>
                      {c.lastMessageAt && (
                        <span className="mf-conv-time">{formatDate(c.lastMessageAt)}</span>
                      )}
                    </div>
                    {c.unreadCount > 0 && <div className="mf-unread-dot" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        className={`mf-trigger ${bounce ? "mf-bounce" : ""}`}
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        title="Tin nhắn"
        aria-label="Mở tin nhắn"
      >
        <FiMessageSquare size={24} />
        {total > 0 && (
          <span className="mf-trigger-badge">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>
    </div>
  );
}
