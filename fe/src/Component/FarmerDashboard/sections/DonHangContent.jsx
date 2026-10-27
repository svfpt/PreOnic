// Tách từ FarmerDashboard.jsx theo SRP: quản lý đơn hàng của nông dân.
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FiFeather, FiCalendar, FiCheck, FiPackage, FiAlertTriangle,
  FiMapPin, FiClock, FiTruck,
} from "react-icons/fi";
import { useToast } from "../../../contexts/ToastContext";
import farmerService from "../../../services/farmer.service";
import escrowService from "../../../services/escrow.service";
import { formatDate } from "../../../hooks/useApiData";

export default function DonHangContent({ searchQuery = "" }) {
  const { showToast } = useToast();
  const [orderStatus, setOrderStatus] = useState("tatca");
  const [apiOrders, setApiOrders] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // orderId being acted on
  // Shipping modal state
  const [shippingModal, setShippingModal] = useState(null); // { order } | null
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [shippingNote, setShippingNote] = useState("");

  const CARRIERS = [
    "Giao hàng nhanh (GHN)",
    "Giao hàng tiết kiệm (GHTK)",
    "Viettel Post",
    "Vietnam Post",
    "J&T Express",
    "Shopee Express",
    "Tự vận chuyển",
  ];

  const ORDER_STEPS = ["Xác nhận", "Chuẩn bị", "Giao hàng", "Kiểm tra", "Hoàn thành"];
  const ORDER_STEP_IDX = { confirmed: 0, processing: 1, shipping: 2, quality_check: 3, delivered: 4, completed: 4 };

  const loadOrders = useCallback(async () => {
    try {
      const res = await farmerService.getOrders();
      setApiOrders(res?.data?.orders || []);
    } catch { setApiOrders([]); }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Map raw API orders to display objects
  const orders = (apiOrders || []).map(o => ({
    id: o.id || o._id,
    contractCode: o.contractCode,
    shop: o.enterpriseName || "Doanh nghiệp",
    product: o.productName,
    quantity: o.quantity,          // already formatted: "100 kg"
    value: o.value || 0,
    status: o.status || "confirmed",
    deliveryDate: o.deliveryDate ? formatDate(o.deliveryDate) : "Chờ xác nhận",
    escrowStatus: o.escrowStatus || "none",
    currentMilestone: o.currentMilestone || null,
    expectedHarvestDate: o.expectedHarvestDate || null,
    shippingAllowed: o.shippingAllowed !== false,
    shippingRestrictionReason: o.shippingRestrictionReason || "",
    completedSteps: o.completedSteps || 0,
    totalSteps: o.totalSteps || 5,
    // escrow id stored separately in raw object
    escrowId: o.escrowId || null,
    _raw: o,
  }));

  const STATUS_LABEL = {
    confirmed: "Đã xác nhận",
    processing: "Chuẩn bị hàng",
    shipping: "Đang giao hàng",
    quality_check: "Kiểm tra chất lượng",
    delivered: "Đã giao",
    completed: "Hoàn thành",
  };

  // Duyệt một lần để tính số lượng theo trạng thái, tránh filter lặp nhiều lần khi render tab.
  const statusCounts = useMemo(() => {
    return orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
  }, [orders]);

  const tabs = [
    { key: "tatca", label: "Tất cả", count: orders.length },
    { key: "confirmed", label: "Đã xác nhận", count: statusCounts.confirmed || 0 },
    { key: "processing", label: "Chuẩn bị", count: statusCounts.processing || 0 },
    { key: "shipping", label: "Đang giao", count: statusCounts.shipping || 0 },
    { key: "quality_check", label: "Kiểm tra", count: statusCounts.quality_check || 0 },
    { key: "delivered", label: "Đã giao", count: statusCounts.delivered || 0 },
  ];

  const getStatusBadge = (s) => {
    const cls = { confirmed: 'fds-blue', processing: 'fds-green', shipping: 'fds-amber', quality_check: 'fds-purple', delivered: 'fds-green', completed: 'fds-gray' }[s] || 'fds-gray';
    return <span className={`fds ${cls}`}>{STATUS_LABEL[s] || s}</span>;
  };

  const normalizedSearch = (searchQuery || "").trim().toLowerCase();

  const filtered = orders
    .filter(o => orderStatus === "tatca" || o.status === orderStatus)
    .filter(o => !normalizedSearch || o.product?.toLowerCase().includes(normalizedSearch) || o.contractCode?.toLowerCase().includes(normalizedSearch));

  // Farmer confirms step 2 (prepared goods)
  const handleConfirmPrepared = async (order) => {
    if (!order.escrowId) {
      showToast("Không tìm thấy thông tin ký quỹ.", "error");
      return;
    }
    setActionLoading(order.id);
    try {
      await escrowService.farmerConfirm(order.escrowId, 2);
      showToast("Đã xác nhận chuẩn bị hàng hóa!", "success");
      await loadOrders();
    } catch (err) {
      showToast(err?.message || "Xác nhận thất bại", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Open shipping modal (step 3)
  const openShippingModal = (order) => {
    if (!order.shippingAllowed) {
      showToast(order.shippingRestrictionReason || "Chưa đến ngày thu hoạch nên chưa thể lên đơn vận chuyển.", "warning");
      return;
    }
    setShippingModal(order);
    setShippingCarrier("");
    setShippingNote("");
  };

  // Farmer confirms step 3 (shipped) + carrier info
  const handleConfirmShipped = async () => {
    if (!shippingModal?.escrowId) {
      showToast("Không tìm thấy thông tin ký quỹ.", "error");
      return;
    }
    if (!shippingCarrier) {
      showToast("Vui lòng chọn đơn vị vận chuyển.", "warning");
      return;
    }
    setActionLoading(shippingModal.id);
    const evidence = `Đơn vị vận chuyển: ${shippingCarrier}${shippingNote ? ` | Ghi chú: ${shippingNote}` : ""}`;
    try {
      await escrowService.farmerConfirm(shippingModal.escrowId, 3, evidence);
      showToast("Đã xác nhận gửi hàng! Hệ thống sẽ thông báo doanh nghiệp khi hàng đến.", "success");
      setShippingModal(null);
      await loadOrders();
    } catch (err) {
      showToast(err?.message || "Xác nhận thất bại", "error");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="fd-pg-header">
        <div>
          <div className="fd-breadcrumb"><span>Trang chủ</span><span className="fd-bc-arrow">›</span><span>Đơn hàng của tôi</span></div>
          <h2>Đơn hàng của tôi</h2>
          <p className="fd-pg-subtitle">Quản lý và theo dõi tiến độ các đơn hàng bao tiêu</p>
        </div>
      </div>
      <div className="fd-pg-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`fd-pg-tab ${orderStatus === t.key ? "active" : ""}`} onClick={() => setOrderStatus(t.key)}>
            {t.label} {t.count > 0 && <span className="fd-pg-tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>
      <div className="fd-list-area">
        {apiOrders === null && (
          <div className="fd-pg-loading">
            <div className="fd-pg-spinner" /><p>Đang tải đơn hàng...</p>
          </div>
        )}
        {apiOrders !== null && filtered.length === 0 && (
          <div className="fd-empty">
            <FiPackage size={40} color="#d1d5db" />
            <h4>Chưa có đơn hàng nào</h4>
            <p>Các đơn hàng từ hợp đồng bao tiêu sẽ xuất hiện ở đây.</p>
          </div>
        )}
        {filtered.map(order => {
          const curIdx = ORDER_STEP_IDX[order.status] ?? -1;
          return (
            <div key={order.id} className="fd-order-card">
              <div className="fd-order-card-head">
                <div>
                  <div className="fd-order-partner">{order.shop}</div>
                  <div className="fd-order-code">Mã HĐ: {order.contractCode}</div>
                </div>
                {getStatusBadge(order.status)}
              </div>
              <div className="fd-order-card-body">
                <div className="fd-order-info">
                  <h4>{order.product}</h4>
                  <p>Số lượng: <strong>{order.quantity}</strong></p>
                  {order.currentMilestone && <p style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><FiMapPin size={13} /> {order.currentMilestone}</p>}
                </div>
                <div className="fd-order-price">
                  <div className="fd-order-amount">{order.value.toLocaleString('vi-VN')}</div>
                  <div className="fd-order-amount-label">VNĐ</div>
                </div>
              </div>
              <div className="fd-order-tracker">
                {ORDER_STEPS.map((step, i) => {
                  const state = i < curIdx ? 'done' : i === curIdx ? 'current' : 'idle';
                  return (
                    <div key={step} className={`fd-ot-step ${state}`}>
                      <div className="fd-ot-dot">{state === 'done' ? '✓' : i + 1}</div>
                      <div className="fd-ot-label">{step}</div>
                    </div>
                  );
                })}
              </div>
              <div className="fd-order-card-foot">
                <span className="fd-order-delivery" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FiCalendar size={12} /> Giao: {order.deliveryDate}</span>
                <div className="fd-order-actions">
                  {order.status === "confirmed" && (
                    <button className="fd-btn fd-btn-green fd-btn-sm" disabled={actionLoading === order.id} onClick={() => handleConfirmPrepared(order)}>
                      {actionLoading === order.id ? "Đang xử lý..." : "Xác nhận chuẩn bị hàng"}
                    </button>
                  )}
                  {order.status === "processing" && (
                    <button
                      className="fd-btn fd-btn-green fd-btn-sm"
                      disabled={actionLoading === order.id || !order.shippingAllowed}
                      onClick={() => openShippingModal(order)}
                      title={!order.shippingAllowed ? (order.shippingRestrictionReason || "Chưa đến ngày thu hoạch") : ""}
                    >
                      {actionLoading === order.id ? "Đang xử lý..." : "Xác nhận giao hàng"}
                    </button>
                  )}
                  {order.status === "processing" && !order.shippingAllowed && (
                    <span style={{ color: '#b45309', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FiClock size={13} /> {order.shippingRestrictionReason || "Chưa đến ngày thu hoạch"}
                    </span>
                  )}
                  {(order.status === "shipping" || order.status === "quality_check") && (
                    <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>Chờ doanh nghiệp xác nhận nhận hàng</span>
                  )}
                  {order.status === "delivered" && (
                    <span style={{ color: '#16a34a', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><FiCheck size={14} /> Đã giao hàng thành công</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== SHIPPING CONFIRMATION MODAL ===== */}
      {shippingModal && (
        <div
          onClick={() => setShippingModal(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(15,23,42,0.45)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 500,
              background: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              padding: "18px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem",
                }}><FiTruck size={18} color="#fff" /></div>
                <div>
                  <h3 style={{ margin: 0, color: "#fff", fontSize: "1.05rem", fontWeight: 700 }}>Xác nhận giao hàng</h3>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: "0.78rem" }}>Bước 3 — Chuẩn bị hàng</p>
                </div>
              </div>
              <button
                onClick={() => setShippingModal(null)}
                style={{
                  background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer",
                  width: 32, height: 32, borderRadius: "50%",
                  color: "#fff", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s",
                }}
              >✕</button>
            </div>

            {/* Order info strip */}
            <div style={{
              background: "#f0fdf4", borderBottom: "1px solid #bbf7d0",
              padding: "12px 24px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: '#dcfce7', borderRadius: 8, flexShrink: 0 }}><FiFeather size={18} color="#15803d" /></span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: "#15803d", fontSize: "0.95rem" }}>{shippingModal.product}</p>
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.82rem" }}>Số lượng: {shippingModal.quantity}</p>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 24px" }}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151", fontSize: "0.9rem" }}>
                  Đơn vị vận chuyển <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={shippingCarrier}
                  onChange={e => setShippingCarrier(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    border: `2px solid ${shippingCarrier ? "#16a34a" : "#e5e7eb"}`,
                    fontSize: "0.9rem", color: "#111827", background: "#fff",
                    outline: "none", transition: "border-color 0.2s", cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">-- Chọn đơn vị vận chuyển --</option>
                  {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151", fontSize: "0.9rem" }}>
                  Ghi chú <span style={{ color: "#9ca3af", fontWeight: 400 }}>(tuỳ chọn)</span>
                </label>
                <textarea
                  value={shippingNote}
                  onChange={e => setShippingNote(e.target.value)}
                  placeholder="Mã vận đơn, thông tin bổ sung..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    border: "2px solid #e5e7eb", fontSize: "0.9rem", color: "#111827",
                    resize: "vertical", outline: "none", fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{
                background: "#fffbeb", border: "1px solid #fde68a",
                borderRadius: 10, padding: "12px 16px",
                display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <FiAlertTriangle size={16} color="#92400e" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#92400e", lineHeight: 1.6 }}>
                  Sau khi xác nhận, hệ thống sẽ tự động thông báo doanh nghiệp sau 2 ngày để xác nhận nhận hàng.
                  <strong> 40% giá trị hợp đồng</strong> sẽ được giải ngân khi doanh nghiệp xác nhận.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #f3f4f6",
              display: "flex", gap: 10, justifyContent: "flex-end",
              background: "#fafafa",
            }}>
              <button
                onClick={() => setShippingModal(null)}
                style={{
                  padding: "10px 22px", borderRadius: 10,
                  border: "1.5px solid #d1d5db", background: "#fff",
                  color: "#374151", fontWeight: 600, fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >Hủy</button>
              <button
                disabled={!shippingCarrier || actionLoading === shippingModal.id}
                onClick={handleConfirmShipped}
                style={{
                  padding: "10px 24px", borderRadius: 10,
                  border: "none",
                  background: !shippingCarrier || actionLoading === shippingModal.id
                    ? "#d1d5db" : "linear-gradient(135deg, #16a34a, #15803d)",
                  color: "#fff", fontWeight: 700, fontSize: "0.9rem",
                  cursor: !shippingCarrier || actionLoading === shippingModal.id ? "not-allowed" : "pointer",
                  boxShadow: !shippingCarrier || actionLoading === shippingModal.id ? "none" : "0 4px 12px rgba(22,163,74,0.35)",
                  transition: "all 0.2s",
                }}
              >
                {actionLoading === shippingModal.id ? "Đang xử lý..." : "✓ Xác nhận đã giao hàng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
