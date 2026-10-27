// Tách từ FarmerDashboard.jsx theo SRP: quản lý hợp đồng của nông dân.
// Dùng chung giao diện chi tiết với Doanh nghiệp qua <ContractDetailView />.
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FiCalendar, FiCheckCircle, FiAlertTriangle, FiFileText, FiEye, FiClock,
} from "react-icons/fi";
import { useToast } from "../../../contexts/ToastContext";
import farmerService from "../../../services/farmer.service";
import contractService from "../../../services/contract.service";
import { formatDate } from "../../../hooks/useApiData";
import ContractDetailView from "../../ContractDetailView/ContractDetailView";
import { LoadingState, EmptyState } from "../../common/DashboardStates";

export default function HopDongContent({ searchQuery = "" }) {
  const { showToast } = useToast();
  const [contracts, setContracts] = useState(null);
  const [statusFilter, setStatusFilter] = useState("tatca");
  const [selectedContract, setSelectedContract] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const CONTRACT_STATUS_LABEL = {
    pending: "Chờ ký",
    approved: "Chờ ký quỹ",
    active: "Đang thực hiện",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    rejected: "Từ chối",
  };

  const PAYMENT_TERMS_LABEL = {
    "50_50": "50% trước – 50% sau",
    "30_70": "30% trước – 70% sau",
    "100_delivery": "100% khi giao hàng",
    "100_upfront": "100% trước",
    custom: "Thoả thuận",
  };

  const getStatusBadge = (s, signedByFarmer) => {
    if (s === "pending" && signedByFarmer) {
      return <span className="fds fds-teal">Đã ký — Chờ DN ký</span>;
    }
    const cls = { pending: "fds-amber", approved: "fds-teal", active: "fds-green", completed: "fds-blue", cancelled: "fds-gray", rejected: "fds-red" }[s] || "fds-gray";
    return <span className={`fds ${cls}`}>{CONTRACT_STATUS_LABEL[s] || s}</span>;
  };

  const loadContracts = useCallback(async () => {
    try {
      const res = await farmerService.getContracts();
      setContracts(res?.data?.contracts || []);
    } catch {
      setContracts([]);
    }
  }, []);

  useEffect(() => { loadContracts(); }, [loadContracts]);

  const statusCounts = useMemo(() => {
    if (!contracts) return {};
    return contracts.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {});
  }, [contracts]);

  const tabs = [
    { key: "tatca", label: "Tất cả", count: contracts?.length || 0 },
    { key: "pending", label: "Chờ ký", count: statusCounts.pending || 0 },
    { key: "active", label: "Đang thực hiện", count: statusCounts.active || 0 },
    { key: "completed", label: "Hoàn thành", count: statusCounts.completed || 0 },
    { key: "cancelled", label: "Đã hủy", count: statusCounts.cancelled || 0 },
  ];

  const normalizedSearch = (searchQuery || "").trim().toLowerCase();
  const filtered = (contracts || [])
    .filter(c => statusFilter === "tatca" || c.status === statusFilter)
    .filter(c => !normalizedSearch ||
      c.contractCode?.toLowerCase().includes(normalizedSearch) ||
      c.enterpriseId?.fullName?.toLowerCase().includes(normalizedSearch) ||
      c.productId?.name?.toLowerCase().includes(normalizedSearch)
    );

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal._id);
    try {
      await contractService.reject(rejectModal._id, rejectReason);
      showToast("Đã từ chối hợp đồng.", "success");
      setRejectModal(null);
      setRejectReason("");
      await loadContracts();
    } catch (err) {
      showToast(err?.message || "Từ chối hợp đồng thất bại", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Mở giao diện chi tiết (full-page, dùng chung với Doanh nghiệp).
  const openDetail = async (contract) => {
    setSelectedContract(contract);
    try {
      const res = await contractService.getById(contract._id);
      if (res?.data?.contract) setSelectedContract(res.data.contract);
    } catch { /* dùng dữ liệu danh sách */ }
  };

  // ===== CHI TIẾT (dùng chung) =====
  if (selectedContract) {
    return (
      <ContractDetailView
        contract={selectedContract}
        role="farmer"
        onBack={() => setSelectedContract(null)}
        onChanged={loadContracts}
      />
    );
  }

  return (
    <>
      <div className="fd-pg-header">
        <div>
          <div className="fd-breadcrumb"><span>Trang chủ</span><span className="fd-bc-arrow">›</span><span>Hợp đồng của tôi</span></div>
          <h2>Hợp đồng của tôi</h2>
          <p className="fd-pg-subtitle">Xem, ký và theo dõi các hợp đồng bao tiêu nông sản</p>
        </div>
      </div>

      <div className="fd-pg-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`fd-pg-tab ${statusFilter === t.key ? "active" : ""}`} onClick={() => setStatusFilter(t.key)}>
            {t.label} {t.count > 0 && <span className="fd-pg-tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="fd-list-area">
        {contracts === null && <LoadingState label="Đang tải hợp đồng..." />}
        {contracts !== null && filtered.length === 0 && (
          <EmptyState
            icon={<FiFileText size={40} />}
            title="Chưa có hợp đồng nào"
            message="Doanh nghiệp sẽ gửi hợp đồng đến đây khi muốn bao tiêu nông sản của bạn."
          />
        )}
        {filtered.map(c => {
          const enterpriseName = c.enterpriseId?.fullName || "Doanh nghiệp";
          const productName = c.productId?.name || "Nông sản";
          const isLoading = actionLoading === c._id;
          return (
            <div key={c._id} className="fd-order-card">
              <div className="fd-order-card-head">
                <div>
                  <div className="fd-order-partner">{enterpriseName}</div>
                  <div className="fd-order-code">Mã HĐ: {c.contractCode}</div>
                </div>
                {getStatusBadge(c.status, c.signedByFarmer)}
              </div>
              <div className="fd-order-card-body">
                <div className="fd-order-info">
                  <h4>{productName}</h4>
                  <p>Thanh toán: <strong>{PAYMENT_TERMS_LABEL[c.paymentTerms] || c.paymentTerms}</strong></p>
                  {c.deliveryDate && (
                    <p style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7280", fontSize: "0.85rem" }}>
                      <FiCalendar size={13} /> Giao hàng: {formatDate(c.deliveryDate)}
                    </p>
                  )}
                </div>
                <div className="fd-order-price">
                  <div className="fd-order-amount">{(c.totalValue || 0).toLocaleString("vi-VN")}</div>
                  <div className="fd-order-amount-label">VNĐ</div>
                </div>
              </div>
              <div className="fd-order-card-foot">
                <span className="fd-order-delivery" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <FiClock size={12} /> Tạo: {new Date(c.createdAt).toLocaleDateString("vi-VN")}
                </span>
                <div className="fd-order-actions">
                  <button className="fd-btn fd-btn-white fd-btn-sm" onClick={() => openDetail(c)}>
                    <FiEye size={13} /> Xem chi tiết
                  </button>
                  {c.status === "pending" && !c.signedByFarmer && (
                    <>
                      <button
                        className="fd-btn fd-btn-green fd-btn-sm"
                        disabled={isLoading}
                        onClick={() => openDetail(c)}
                      >
                        <FiCheckCircle size={13} /> Ký hợp đồng
                      </button>
                      <button
                        className="fd-btn fd-btn-sm"
                        disabled={isLoading}
                        onClick={() => { setRejectModal(c); setRejectReason(""); }}
                        style={{ background: "#fee2e2", color: "#dc2626", border: "none" }}
                      >
                        <FiAlertTriangle size={13} /> Từ chối
                      </button>
                    </>
                  )}
                  {c.status === "pending" && c.signedByFarmer && (
                    <span style={{ fontSize: 12, color: "#0891b2", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      <FiCheckCircle size={12} /> Bạn đã ký — Chờ doanh nghiệp ký
                    </span>
                  )}
                  {c.status === "active" && (
                    <button
                      className="fd-btn fd-btn-sm"
                      disabled={isLoading}
                      onClick={() => openDetail(c)}
                      style={{ background: "#fef3c7", color: "#d97706", border: "none" }}
                    >
                      Hủy hợp đồng
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== REJECT MODAL ===== */}
      {rejectModal && (
        <div onClick={() => setRejectModal(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FiAlertTriangle size={20} color="#fff" />
                <div>
                  <h3 style={{ margin: 0, color: "#fff", fontSize: "1.05rem", fontWeight: 700 }}>Từ chối hợp đồng</h3>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: "0.78rem" }}>{rejectModal.contractCode}</p>
                </div>
              </div>
              <button onClick={() => setRejectModal(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", width: 32, height: 32, borderRadius: "50%", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ marginBottom: 12, color: "#374151", fontSize: "0.9rem" }}>
                Bạn đang từ chối hợp đồng với <strong>{rejectModal.enterpriseId?.fullName}</strong>. Vui lòng cho biết lý do:
              </p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Nêu lý do từ chối hợp đồng..."
                rows={3}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px solid #e5e7eb", fontSize: "0.9rem", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 10, justifyContent: "flex-end", background: "#fafafa" }}>
              <button onClick={() => setRejectModal(null)} style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" }}>Hủy</button>
              <button
                onClick={handleReject}
                disabled={actionLoading === rejectModal._id}
                style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: actionLoading === rejectModal._id ? "#d1d5db" : "#ef4444", color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: actionLoading === rejectModal._id ? "not-allowed" : "pointer" }}
              >
                {actionLoading === rejectModal._id ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
