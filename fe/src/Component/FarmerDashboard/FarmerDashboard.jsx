import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import {
  ROUTES,
  FARMER_DASHBOARD_NAV_ITEMS,
} from "../../constants";
import MuaVuContent from "./sections/MuaVuContent";
import FarmerWeatherContent from "./sections/FarmerWeatherContent";
import HopDongContent from "./sections/HopDongContent";
import DonHangContent from "./sections/DonHangContent";
import DangBanContent from "./sections/DangBanContent";
import FarmerEscrowContent from "./sections/FarmerEscrowContent";
import FarmerFinanceContent from "./sections/FarmerFinanceContent";
import WalletPayment from "../WalletPayment/WalletPayment";
import BilateralRating from "../BilateralRating/BilateralRating";
import FeedbackContent from "../Feedback/FeedbackContent";
import NotificationBell from "../NotificationBell/NotificationBell";
import MessengerFloat from "../MessengerFloat/MessengerFloat";
import "../common/DashboardResponsive.css";
import "./FarmerDashboard.css";
import "../common/DashboardVisualTheme.css";

// Tệp này điều phối toàn bộ dashboard nông dân: điều hướng tab, dữ liệu tổng quan và các thao tác nghiệp vụ chính.
export default function FarmerDashboard() {
  const [activeTab, setActiveTab] = useState("muavu");
  const [headerSearch, setHeaderSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.HOME);
  };

  // Chuyển tab + đóng drawer trên mobile.
  const go = (tab) => { setActiveTab(tab); setSidebarOpen(false); };

  return (
    <div className="fd-wrapper">
      {sidebarOpen && <div className="dash-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      {/* SIDEBAR */}
      <aside className={`fd-sidebar dash-drawer ${sidebarOpen ? "open" : ""}`}>
        <div className="fd-logo" onClick={() => navigate(ROUTES.HOME)} style={{ cursor: "pointer" }}>
          <div className="logo-icon"><span className="logo-leaf" /></div>
          <div className="logo-text"><h1>PreOnic</h1><p>Nông dân</p></div>
        </div>

        <button
          className={`fd-create ${activeTab === "dangban" ? "active" : ""}`}
          onClick={() => go("dangban")}
        >
          <span className="fd-create-plus">+</span> Đăng bán nông sản mới
        </button>

        <nav className="fd-nav" role="tablist" aria-label="Điều hướng nông dân">
          {FARMER_DASHBOARD_NAV_ITEMS.map(item => (
            <button
              key={item.key}
              role="tab"
              aria-selected={activeTab === item.key}
              className={`${item.cls} ${activeTab === item.key ? "active" : ""}`}
              onClick={() => go(item.key)}
            >
              <span className={`nav-icon ${item.cls}-icon`} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="fd-sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <span className="nav-icon logout-sidebar-icon" aria-hidden="true" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="fd-main">
        <header className="fd-header">
          <button
            className="dash-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu điều hướng"
          >
            <FiMenu size={20} />
          </button>
          <div className="fd-header-search">
            <span className="search-input-icon" aria-hidden="true" />
            <input type="text" aria-label="Tìm kiếm" placeholder="Tìm kiếm hợp đồng, đơn hàng..." value={headerSearch} onChange={e => setHeaderSearch(e.target.value)} />
          </div>
          <div className="fd-header-actions">
            <NotificationBell onNavigate={go} />
            <div className="divider" />
            <div className="fd-user-profile" onClick={() => navigate(ROUTES.PROFILE)} style={{ cursor: "pointer" }}>
              <div className="fd-user-info">
                <p className="fd-user-name">{user?.fullName || "Nông dân"}</p>
                <p className="fd-user-role">Quản lý nông trại</p>
              </div>
              <div className="fd-user-avatar">{(user?.fullName || "ND").slice(0, 2).toUpperCase()}</div>
            </div>
          </div>
        </header>
        <div className="fd-content">
          {activeTab === "muavu" && <MuaVuContent user={user} onNavigate={go} />}
          {activeTab === "hopdong" && <HopDongContent searchQuery={headerSearch} />}
          {activeTab === "donhang" && <DonHangContent searchQuery={headerSearch} />}
          {activeTab === "escrow" && <FarmerEscrowContent />}
          {activeTab === "vi" && <WalletPayment role="farmer" />}
          {activeTab === "taichinh" && <FarmerFinanceContent />}
          {activeTab === "danhgia" && <BilateralRating currentRole="farmer" />}
          {activeTab === "thoitiet" && <FarmerWeatherContent />}
          {activeTab === "feedback" && <FeedbackContent />}
          {activeTab === "dangban" && <DangBanContent />}
        </div>
      </main>

      <MessengerFloat />
    </div>
  );
}
