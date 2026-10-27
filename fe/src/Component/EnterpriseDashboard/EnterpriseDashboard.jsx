import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import {
  ROUTES,
  ENTERPRISE_DASHBOARD_NAV_ITEMS,
  SEARCH_PLACEHOLDERS,
} from "../../constants";
import NotificationBell from "../NotificationBell/NotificationBell";
import MessengerFloat from "../MessengerFloat/MessengerFloat";
import TongQuanContent from "./sections/TongQuanContent";
import SanPhamContent from "./sections/SanPhamContent";
import WeatherInsuranceContent from "./sections/WeatherInsuranceContent";
import HopDongContent from "./sections/HopDongContent";
import DonHangContent from "./sections/DonHangContent";
import LichSuGiaoDichContent from "./sections/LichSuGiaoDichContent";
import EscrowContent from "./sections/EscrowContent";
import SuppliersContent from "./sections/SuppliersContent";
import WalletPayment from "../WalletPayment/WalletPayment";
import BilateralRating from "../BilateralRating/BilateralRating";
import FeedbackContent from "../Feedback/FeedbackContent";
import "../common/DashboardResponsive.css";
import "./EnterpriseDashboard.css";
import "./dh-styles.css";
import "../common/DashboardVisualTheme.css";

// Tệp này điều phối toàn bộ dashboard doanh nghiệp: điều hướng tab, thống kê, đơn hàng và các thao tác tài chính.
export default function EnterpriseDashboard() {
  const location = useLocation();
  const [activeNav, setActiveNav] = useState(location.state?.activeNav || "tongguan");
  const [headerSearch, setHeaderSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.HOME);
  };

  // Chuyển tab + đóng drawer trên mobile.
  const go = (nav) => { setActiveNav(nav); setSidebarOpen(false); };

  return (
    <div className="ed-layout">
      {sidebarOpen && <div className="dash-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      {/* SIDEBAR */}
      <aside className={`ed-sidebar dash-drawer ${sidebarOpen ? "open" : ""}`}>
        <div className="ed-logo" onClick={() => navigate(ROUTES.HOME)} style={{ cursor: "pointer" }}>
          <div className="logo-icon"><span className="logo-leaf" /></div>
          <div className="logo-text"><h1>PreOnic</h1><p>Cổng Doanh nghiệp</p></div>
        </div>

        <nav className="ed-nav" role="tablist" aria-label="Điều hướng doanh nghiệp">
          {ENTERPRISE_DASHBOARD_NAV_ITEMS.map(item => (
            <button
              key={item.key}
              role="tab"
              aria-selected={activeNav === item.key}
              className={`${item.cls} ${activeNav === item.key ? "active" : ""}`}
              onClick={() => go(item.key)}
            >
              <span className={`nav-icon ${item.cls}-icon`} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="ed-sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <span className="nav-icon logout-sidebar-icon" aria-hidden="true" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="ed-main">
        <header className="ed-header">
          <button
            className="dash-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu điều hướng"
          >
            <FiMenu size={20} />
          </button>
          <div className="header-search">
            <span className="search-input-icon" aria-hidden="true" />
            <input type="text" aria-label="Tìm kiếm" placeholder={SEARCH_PLACEHOLDERS.ENTERPRISE_DASHBOARD} value={headerSearch} onChange={e => setHeaderSearch(e.target.value)} />
          </div>
          <div className="header-actions">
            <NotificationBell onNavigate={go} />
            <div className="divider"></div>
            <div className="user-profile" onClick={() => navigate(ROUTES.PROFILE)} style={{ cursor: "pointer" }}>
              <div className="user-info">
                <p className="user-name">{user?.fullName || "Doanh nghiệp"}</p>
                <p className="user-role">Quản lý thu mua</p>
              </div>
              <div className="user-avatar">{(user?.fullName || "DN").slice(0, 2).toUpperCase()}</div>
            </div>
          </div>
        </header>

        <div className="ed-content">
          {activeNav === "tongguan" && <TongQuanContent onNavigate={go} />}
          {activeNav === "hopdong" && <HopDongContent searchQuery={headerSearch} onNavigate={go} />}
          {activeNav === "sanpham" && <SanPhamContent navigate={navigate} />}
          {activeNav === "donhang" && <DonHangContent searchQuery={headerSearch} onNavigate={go} />}
          {activeNav === "escrow" && <EscrowContent />}
          {activeNav === "vi" && <WalletPayment role="enterprise" />}
          {activeNav === "nhacc" && <SuppliersContent />}
          {activeNav === "lichsu" && <LichSuGiaoDichContent />}
          {activeNav === "danhgia" && <BilateralRating currentRole="enterprise" />}
          {activeNav === "thoitiet" && <WeatherInsuranceContent />}
          {activeNav === "feedback" && <FeedbackContent />}
        </div>
      </main>

      <MessengerFloat />
    </div>
  );
}
