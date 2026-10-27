// Chuông thông báo TIN NHẮN — tách riêng khỏi NotificationBell.
// Hiển thị số tin chưa đọc; bấm vào một mục → mở thẳng cuộc trò chuyện đó.
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiMessageCircle } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { ROUTES } from "../../constants";
import messagingService from "../../services/messaging.service";
import { formatDate } from "../../hooks/useApiData";
import "../NotificationBell/NotificationBell.css";

export default function MessageBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const res = await messagingService.getUnreadCount();
      if (res?.data) {
        setItems(res.data.conversations || []);
        setTotal(res.data.total || 0);
      }
    } catch { /* im lặng */ }
  };

  useEffect(() => {
    if (!user) return;
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const openConversation = (conversationId) => {
    setOpen(false);
    navigate(`${ROUTES.MESSAGING}?conversationId=${conversationId}`);
  };

  const roleLabel = (r) => (r === "enterprise" ? "Doanh nghiệp" : "Nông dân");

  return (
    <div className="notif-bell-wrapper" ref={ref}>
      <button
        className="notification-btn"
        title="Tin nhắn"
        onClick={() => { setOpen(!open); if (!open) load(); }}
      >
        <FiMessageCircle size={18} />
        {total > 0 && <span className="notif-dot">{total > 9 ? "9+" : total}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <h4>Tin nhắn chưa đọc</h4>
            <button className="mark-all-btn" onClick={() => { setOpen(false); navigate(ROUTES.MESSAGING); }}>
              Xem tất cả
            </button>
          </div>
          <div className="notif-dropdown-list">
            {items.length === 0 ? (
              <p className="notif-empty">Không có tin nhắn mới</p>
            ) : (
              items.map((c) => (
                <div
                  key={c.conversationId}
                  className="notif-item unread"
                  onClick={() => openConversation(c.conversationId)}
                >
                  <span className="notif-icon type-message">
                    {(c.partnerName || "ND").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="notif-content">
                    <p className="notif-title">{c.partnerName} · <span style={{ fontWeight: 500, color: "#7a9e82" }}>{roleLabel(c.partnerRole)}</span></p>
                    <p className="notif-desc">{c.lastMessage || "Tin nhắn mới"}</p>
                    <span className="notif-time">{c.lastMessageAt ? formatDate(c.lastMessageAt) : ""}</span>
                  </div>
                  <span className="notif-dot" style={{ position: "static", border: "none" }}>{c.unreadCount}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
