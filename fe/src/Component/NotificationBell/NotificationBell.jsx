import { useState, useEffect, useRef } from "react";
import { FiFileText, FiDollarSign, FiPackage, FiCloud, FiBell, FiShield } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import notificationService from "../../services/notification.service";
import { formatDate } from "../../hooks/useApiData";
import "./NotificationBell.css";

// Bản đồ: loại thông báo / model liên quan → mục (tab) cần điều hướng đến trong dashboard.
// Các key tab này tồn tại ở CẢ FarmerDashboard lẫn EnterpriseDashboard.
const SECTION_BY_TYPE = {
  contract: "hopdong",
  escrow: "escrow",
  weather_alert: "thoitiet",
  insurance: "thoitiet",
  order: "donhang",
  system: null,
};
const SECTION_BY_MODEL = {
  Contract: "hopdong",
  Escrow: "escrow",
  WeatherAlert: "thoitiet",
  Dispute: "hopdong",
};

function resolveSection(n) {
  return SECTION_BY_MODEL[n.relatedModel] || SECTION_BY_TYPE[n.type] || null;
}

// onNavigate(sectionKey): do dashboard cha truyền vào để chuyển tab khi bấm thông báo.
export default function NotificationBell({ onNavigate }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await notificationService.getNotifications(1, 10);
      if (res?.data) {
        setNotifications(res.data);
        setUnreadCount(res.data.filter((n) => !n.isRead).length);
      }
    } catch { /* silent */ }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await notificationService.getUnreadCount();
      if (res?.data?.count != null) setUnreadCount(res.data.count);
    } catch { /* silent */ }
  };

  const markRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  // Bấm vào thông báo: đánh dấu đã đọc + điều hướng đến mục liên quan.
  const handleClickNotif = (n) => {
    if (!n.isRead) markRead(n._id);
    const section = resolveSection(n);
    if (section && onNavigate) {
      onNavigate(section);
      setOpen(false);
    }
  };

  const getIcon = (type) => {
    const icons = {
      contract: <FiFileText size={16} />,
      escrow: <FiDollarSign size={16} />,
      order: <FiPackage size={16} />,
      weather_alert: <FiCloud size={16} />,
      insurance: <FiShield size={16} />,
      system: <FiBell size={16} />,
    };
    return icons[type] || <FiBell size={16} />;
  };

  return (
    <div className="notif-bell-wrapper" ref={ref}>
      <button
        className="notification-btn"
        title="Thông báo"
        onClick={() => { setOpen(!open); if (!open) loadNotifications(); }}
      >
        <FiBell size={18} />
        {unreadCount > 0 && <span className="notif-dot">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <h4>Thông báo</h4>
            {unreadCount > 0 && (
              <button className="mark-all-btn" onClick={handleMarkAllRead}>Đọc tất cả</button>
            )}
          </div>
          <div className="notif-dropdown-list">
            {notifications.length === 0 ? (
              <p className="notif-empty">Không có thông báo mới</p>
            ) : (
              notifications.map((n) => {
                const navigable = !!resolveSection(n);
                return (
                  <div
                    key={n._id}
                    className={`notif-item ${n.isRead ? "read" : "unread"}`}
                    style={navigable ? { cursor: "pointer" } : undefined}
                    onClick={() => handleClickNotif(n)}
                  >
                    <span className={`notif-icon type-${n.type}${n.severity === "critical" ? " sev-critical" : ""}`}>
                      {getIcon(n.type)}
                    </span>
                    <div className="notif-content">
                      <p className="notif-title">{n.title || n.message}</p>
                      {n.message && n.title && <p className="notif-desc">{n.message}</p>}
                      <span className="notif-time">
                        {n.createdAt ? formatDate(n.createdAt) : ""}
                        {navigable && <span className="notif-cta"> · Xem chi tiết →</span>}
                      </span>
                    </div>
                    {!n.isRead && <span className="notif-unread-dot" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
