import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { ROUTES } from "../../constants";
import "../common/DashboardResponsive.css";
import TongQuanContent from "./sections/TongQuanContent";
import QuanLyNguoiDung from "./sections/QuanLyNguoiDung";
import QuanLyHopDong from "./sections/QuanLyHopDong";
import QuanLyKhieuNai from "./sections/QuanLyKhieuNai";
import QuanLyGiaoDich from "./sections/QuanLyGiaoDich";
import QuanLyRutTien from "./sections/QuanLyRutTien";
import QuanLyFeedback from "./sections/QuanLyFeedback";
import "./AdminDashboard.css";

const NAV_ITEMS = [
  { key: "tongquan",   label: "Tổng quan",           icon: "TQ" },
  { key: "nguoidung",  label: "Quản lý Người dùng",   icon: "ND" },
  { key: "hopdong",    label: "Quản lý Hợp đồng",     icon: "HD" },
  { key: "khieuuai",  label: "Quản lý Khiếu nại",    icon: "KN" },
  { key: "giaodich",  label: "Quản lý Giao dịch",    icon: "GD" },
  { key: "ruttien",   label: "Quản lý Rút tiền",     icon: "RT" },
  { key: "feedback",  label: "Phản hồi hệ thống",    icon: "PH" },
];

export default function AdminDashboard() {
  const [activeNav, setActiveNav] = useState("tongquan");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.HOME);
  };

  const go = (nav) => { setActiveNav(nav); setSidebarOpen(false); };

  return (
    <div className="ad-layout">
      {sidebarOpen && <div className="dash-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      {/* SIDEBAR */}
      <aside className={`ad-sidebar dash-drawer ${sidebarOpen ? "open" : ""}`}>
        <div className="ad-logo" onClick={() => navigate(ROUTES.HOME)} style={{ cursor: "pointer" }}>
          <div className="ad-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div className="ad-logo-text">
            <h1>PreOnic</h1>
            <p>Bảng quản trị</p>
          </div>
        </div>

        <nav className="ad-nav" role="tablist" aria-label="Điều hướng quản trị">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              role="tab"
              aria-selected={activeNav === item.key}
              className={`ad-nav-btn ${activeNav === item.key ? "active" : ""}`}
              onClick={() => go(item.key)}
            >
              <span className="ad-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="ad-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="ad-sidebar-footer">
          <button className="ad-logout-btn" onClick={handleLogout}>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="ad-main">
        <header className="ad-header">
          <div className="ad-header-left">
            <button
              className="dash-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Mở menu điều hướng"
              style={{ marginRight: 4 }}
            >
              <FiMenu size={20} />
            </button>
            <span className="ad-admin-badge">Admin</span>
            <span className="ad-header-title">
              {NAV_ITEMS.find(n => n.key === activeNav)?.label || "Tổng quan"}
            </span>
          </div>
          <div className="ad-header-right">
            <div className="ad-user-info">
              <div className="ad-user-avatar">{(user?.fullName || "AD").slice(0, 2).toUpperCase()}</div>
              <div className="ad-user-text">
                <span className="ad-user-name">{user?.fullName || "Admin"}</span>
                <span className="ad-user-role">Quản trị viên</span>
              </div>
            </div>
          </div>
        </header>

        <div className="ad-content">
          {activeNav === "tongquan"   && <TongQuanContent onNavigate={setActiveNav} />}
          {activeNav === "nguoidung"  && <QuanLyNguoiDung />}
          {activeNav === "hopdong"    && <QuanLyHopDong />}
          {activeNav === "khieuuai"  && <QuanLyKhieuNai />}
          {activeNav === "giaodich"  && <QuanLyGiaoDich />}
          {activeNav === "ruttien"   && <QuanLyRutTien />}
          {activeNav === "feedback"  && <QuanLyFeedback />}
        </div>
      </main>
    </div>
  );
}
