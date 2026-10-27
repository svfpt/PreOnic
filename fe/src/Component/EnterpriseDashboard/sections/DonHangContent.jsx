import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "../../../contexts/ToastContext";
import enterpriseService from "../../../services/enterprise.service";
import escrowService from "../../../services/escrow.service";
import { formatMoney, formatDate } from "../../../hooks/useApiData";

/* ──────────────────────────────────────────────────────────────
   Theo Dõi Đơn Hàng — Cổng Doanh nghiệp (redesign 2.0)
   • Trạng thái đơn suy ra trực tiếp từ milestone escrow (BE).
   • Mọi thao tác escrow gọi qua escrowId trả sẵn — không round-trip phụ.
   • Cơ chế nghiệp vụ giữ nguyên: ký quỹ → chuẩn bị → giao → kiểm tra CL → hoàn tất.
─────────────────────────────────────────────────────────────── */

// 5 bước pipeline — đồng bộ với milestone step 1..5 phía BE.
const STEPS = [
  { step: 1, short: "Ký quỹ",     label: "Ký quỹ",            desc: "Doanh nghiệp nạp ký quỹ theo giá trị hợp đồng" },
  { step: 2, short: "Chuẩn bị",   label: "Chuẩn bị hàng",     desc: "Nông dân chuẩn bị, đóng gói sản phẩm" },
  { step: 3, short: "Vận chuyển", label: "Giao hàng",         desc: "Hàng đang trên đường đến điểm nhận" },
  { step: 4, short: "Kiểm tra",   label: "Kiểm tra chất lượng", desc: "Doanh nghiệp nhận và kiểm tra chất lượng" },
  { step: 5, short: "Hoàn tất",   label: "Hoàn tất",          desc: "Giao thành công, giải ngân số dư còn lại" },
];

const STATUS_META = {
  awaiting_deposit: { label: "Chờ ký quỹ",      cls: "await" },
  processing:       { label: "Đang xử lý",       cls: "process" },
  shipping:         { label: "Đang vận chuyển",  cls: "ship" },
  quality_check:    { label: "Kiểm tra CL",      cls: "qc" },
  delivered:        { label: "Hoàn tất",         cls: "done" },
  disputed:         { label: "Khiếu nại",        cls: "dispute" },
  cancelled:        { label: "Đã hủy",           cls: "cancel" },
};

const ESCROW_LABELS = {
  none:               "Chưa có ký quỹ",
  awaiting_deposit:   "Chờ nạp ký quỹ",
  funded:             "Đã ký quỹ",
  partially_released: "Đang giải ngân",
  fully_released:     "Đã giải ngân đủ",
  refunded:           "Đã hoàn trả",
  disputed:           "Đang tranh chấp",
};

const PAYMENT_TERMS_LABELS = {
  "50_50":        "50% trước · 50% hoàn tất",
  "30_70":        "30% trước · 70% hoàn tất",
  "100_upfront":  "100% trả trước",
  "100_delivery": "100% khi nhận hàng",
};

// Trạng thái từng bước trên thanh tiến trình, suy từ milestones thật.
function getStepStates(order) {
  const ms = order.milestones || [];
  return STEPS.map(({ step }) => {
    const m = ms.find((x) => x.step === step);
    if (!m) return order.currentMilestoneStep === step ? "active" : "pending";
    if (m.status === "completed") return "done";
    if (m.status === "disputed") return "disputed";
    if (m.status === "in_progress") return "active";
    return order.currentMilestoneStep === step ? "active" : "pending";
  });
}

// Gợi ý hành động kế tiếp cho doanh nghiệp.
function getActionHint(order) {
  switch (order.status) {
    case "cancelled":
      return { tone: "muted", text: "Đơn hàng đã hủy" };
    case "disputed":
      return { tone: "danger", text: "Đang chờ PreOnic phân giải khiếu nại (3–5 ngày)" };
    case "awaiting_deposit":
      return { tone: "warn", text: "Chờ nạp ký quỹ để kích hoạt đơn hàng" };
    case "delivered":
      return { tone: "ok", text: "Đơn hàng đã hoàn tất — cảm ơn bạn!" };
    case "quality_check":
      return order.enterpriseCanConfirm
        ? { tone: "ok", text: "Cần bạn kiểm tra & xác nhận chất lượng hàng" }
        : { tone: "info", text: "Đang xử lý kiểm tra chất lượng" };
    case "shipping":
      return { tone: "info", text: "Đang chờ nông dân giao hàng" };
    case "processing":
      return { tone: "info", text: "Nông dân đang chuẩn bị hàng hóa" };
    default:
      return { tone: "info", text: "Đang theo dõi tiến độ" };
  }
}

export default function DonHangContent({ searchQuery = "", onNavigate }) {
  const [orderTab, setOrderTab] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [apiOrders, setApiOrders] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [returnModal, setReturnModal] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [qcChecked, setQcChecked] = useState([false, false, false, false]);
  const [qcVerifiedByOrder, setQcVerifiedByOrder] = useState({});
  const [qcFocus, setQcFocus] = useState(false);
  const qcPanelRef = useRef(null);
  const toast = useToast();

  const loadOrders = useCallback(async () => {
    try {
      const res = await enterpriseService.getOrders();
      const mapped = (res?.data?.orders || []).map((o) => ({
        contractId: o.id,
        contractCode: o.contractCode || String(o.id),
        supplier: o.farmerName || "Nông dân",
        product: o.productName || "Nông sản",
        quantity: o.quantity || "N/A",
        value: formatMoney(o.value || 0),
        rawValue: o.value || 0,
        pricePerUnit: o.pricePerUnit || 0,
        paymentTerms: o.paymentTerms || null,
        status: o.status,
        contractStatus: o.contractStatus,
        eta: formatDate(o.deliveryDate),
        orderDate: formatDate(o.createdAt),
        completedDate: o.completedAt ? formatDate(o.completedAt) : null,
        cancelReason: o.cancelReason || null,
        escrowId: o.escrowId || null,
        escrowStatus: o.escrowStatus || "none",
        totalAmount: o.totalAmount || 0,
        depositedAmount: o.depositedAmount || 0,
        releasedAmount: o.releasedAmount || 0,
        milestones: o.milestones || [],
        currentMilestone: o.currentMilestone || null,
        currentMilestoneStep: o.currentMilestoneStep || null,
        completedSteps: o.completedSteps || 0,
        totalSteps: o.totalSteps || 5,
        enterpriseCanConfirm: Boolean(o.enterpriseCanConfirm),
        enterpriseConfirmStep: o.enterpriseConfirmStep || null,
        disputeStep: o.disputeStep || null,
        canCreateEscrow: Boolean(o.canCreateEscrow),
        canDeposit: Boolean(o.canDeposit),
        canDispute: Boolean(o.canDispute),
        waitingFor: o.waitingFor || null,
      }));
      setApiOrders(mapped);
    } catch {
      setApiOrders([]);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Đồng bộ checklist QC theo đơn đang xem.
  useEffect(() => {
    if (!selectedOrder || selectedOrder.status !== "quality_check") {
      setQcChecked([false, false, false, false]);
      return;
    }
    setQcChecked(
      qcVerifiedByOrder[selectedOrder.contractId]
        ? [true, true, true, true]
        : [false, false, false, false]
    );
  }, [selectedOrder, qcVerifiedByOrder]);

  // Cuộn tới panel QC khi mở chi tiết qua nút "Kiểm tra CL".
  useEffect(() => {
    if (!qcFocus || !selectedOrder) return;
    if (selectedOrder.status !== "quality_check" || selectedOrder.escrowStatus === "none") return;
    const timer = setTimeout(() => {
      qcPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(timer);
  }, [qcFocus, selectedOrder]);

  const closeSelectedOrder = useCallback(() => {
    setSelectedOrder(null);
    setQcFocus(false);
  }, []);

  const orders = apiOrders || [];

  // ── Thống kê ──
  const actionableCount = orders.filter((o) => o.enterpriseCanConfirm || o.canDeposit).length;
  const awaitingDepositCount = orders.filter((o) => o.status === "awaiting_deposit").length;
  const shippingCount = orders.filter((o) => o.status === "shipping").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const disputedCount = orders.filter((o) => o.status === "disputed").length;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
  const totalValue = orders.reduce((sum, o) => sum + o.rawValue, 0);

  const baseTabs = [
    { key: "all",              label: "Tất cả" },
    { key: "awaiting_deposit", label: "Chờ ký quỹ" },
    { key: "processing",       label: "Đang xử lý" },
    { key: "shipping",         label: "Vận chuyển" },
    { key: "quality_check",    label: "Kiểm tra CL" },
    { key: "delivered",        label: "Hoàn tất" },
    { key: "disputed",         label: "Khiếu nại" },
  ];
  if (cancelledCount > 0) baseTabs.push({ key: "cancelled", label: "Đã hủy" });
  const orderTabs = baseTabs.map((t) => ({
    ...t,
    count: t.key === "all" ? orders.length : orders.filter((o) => o.status === t.key).length,
  }));

  const filtered = orders
    .filter((o) => orderTab === "all" || o.status === orderTab)
    .filter((o) =>
      !searchQuery ||
      o.product?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.contractCode?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // ── Actions ──
  const handleCreateEscrow = async (order) => {
    setActionLoading(true);
    try {
      await escrowService.create(order.contractId);
      toast.success('Tạo ký quỹ thành công! Vào "Thanh toán trung gian" để nạp tiền.');
      await loadOrders();
    } catch (err) {
      toast.error(err?.message || "Tạo ký quỹ thất bại. Vui lòng thử lại.");
    } finally {
      setActionLoading(false);
      setActionModal(null);
    }
  };

  const goDeposit = () => {
    closeSelectedOrder();
    setActionModal(null);
    if (onNavigate) onNavigate("escrow");
    else toast.info('Vào mục "Thanh toán trung gian" để nạp ký quỹ.');
  };

  const handleMilestoneConfirm = async (order) => {
    if (!order.enterpriseCanConfirm || !order.enterpriseConfirmStep) {
      const msgs = {
        farmer: "Đang chờ nông dân xác nhận.",
        system: "Hệ thống đang xử lý.",
        admin: "Đơn đang trong quá trình phân giải khiếu nại.",
      };
      toast.warning(msgs[order.waitingFor] || "Đơn hàng chưa sẵn sàng để xác nhận.");
      setActionModal(null);
      return;
    }
    // Bước kiểm tra CL: buộc hoàn tất checklist trước khi giải ngân.
    if (order.status === "quality_check" && !qcVerifiedByOrder[order.contractId]) {
      toast.warning("Vui lòng hoàn tất checklist kiểm tra chất lượng trước khi xác nhận.");
      setQcFocus(true);
      setSelectedOrder(order);
      setActionModal(null);
      return;
    }
    if (!order.escrowId) {
      toast.error("Không tìm thấy ký quỹ cho đơn hàng này.");
      setActionModal(null);
      return;
    }
    setActionLoading(true);
    try {
      await escrowService.enterpriseConfirm(order.escrowId, order.enterpriseConfirmStep);
      toast.success("Xác nhận thành công! Tiền sẽ được giải ngân cho nông dân.");
      await loadOrders();
    } catch (err) {
      toast.error(err?.message || "Xác nhận thất bại. Vui lòng thử lại.");
    } finally {
      setActionLoading(false);
      setActionModal(null);
    }
  };

  const handleReturnGoods = async () => {
    if (!returnReason.trim()) { toast.warning("Vui lòng cung cấp lý do trả hàng."); return; }
    if (!returnModal.escrowId) { toast.error("Không tìm thấy ký quỹ cho đơn hàng này."); return; }
    setReturnLoading(true);
    try {
      const disputeStep = returnModal.disputeStep || returnModal.currentMilestoneStep || 4;
      await escrowService.raiseDispute(returnModal.escrowId, disputeStep, returnReason.trim(), []);
      toast.success("Đã gửi khiếu nại. PreOnic sẽ phân giải trong 3–5 ngày làm việc.");
      setReturnModal(null);
      setReturnReason("");
      await loadOrders();
    } catch (err) {
      toast.error(err?.message || "Gửi khiếu nại thất bại.");
    } finally {
      setReturnLoading(false);
    }
  };

  const openConfirm = (order) => { setActionModal({ order, type: "confirm_milestone" }); };
  const openDispute = (order) => { setReturnReason(""); setReturnModal(order); };

  return (
    <>
      {/* ── Breadcrumb ── */}
      <div className="breadcrumb">
        <span>Trang chủ</span>
        <span className="arrow">&gt;</span>
        <span>Theo dõi đơn hàng</span>
      </div>

      {/* ── Header ── */}
      <div className="dh-head">
        <div>
          <h1 className="dh-title">Theo Dõi Đơn Hàng</h1>
          <p className="dh-sub">Giám sát tiến độ hợp đồng thu mua nông sản — từ ký quỹ đến hoàn tất giao dịch</p>
        </div>
        <button className="dh-refresh" onClick={loadOrders} title="Làm mới">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Làm mới
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="dh-stats">
        <StatCard tone="total" value={orders.length} label="Tổng đơn hàng"
          icon={<><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></>} />
        <StatCard tone="action" value={actionableCount} label="Cần bạn xử lý" pulse={actionableCount > 0}
          icon={<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>} />
        <StatCard tone="ship" value={shippingCount} label="Đang vận chuyển"
          icon={<><rect x="1" y="3" width="15" height="13" rx="1" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>} />
        <StatCard tone="done" value={deliveredCount} label="Đã hoàn tất"
          icon={<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>} />
        <div className="dh-stat dh-stat-value">
          <div className="dh-stat-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="dh-stat-body">
            <span className="dh-stat-num dh-stat-money">{totalValue.toLocaleString("vi-VN")} <small>₫</small></span>
            <span className="dh-stat-lbl">Tổng giá trị đơn hàng</span>
          </div>
        </div>
      </div>

      {/* ── Alerts ── */}
      {(actionableCount > 0 || awaitingDepositCount > 0 || disputedCount > 0) && (
        <div className="dh-alerts">
          {actionableCount > 0 && (
            <div className="dh-alert dh-alert-ok">
              <AlertIcon kind="check" />
              <span><strong>{actionableCount} đơn hàng</strong> đang chờ bạn xác nhận hoặc nạp ký quỹ — xử lý sớm để dòng tiền lưu thông.</span>
            </div>
          )}
          {disputedCount > 0 && (
            <div className="dh-alert dh-alert-danger">
              <AlertIcon kind="warn" />
              <span><strong>{disputedCount} đơn hàng</strong> đang trong quá trình khiếu nại — PreOnic sẽ phân giải trong 3–5 ngày làm việc.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="dh-tabs">
        {orderTabs.map((t) => (
          <button key={t.key} className={`dh-tab ${orderTab === t.key ? "active" : ""}`} onClick={() => setOrderTab(t.key)}>
            {t.label}
            {t.count > 0 && <span className="dh-tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ══ MODAL: Xác nhận mốc ══ */}
      {actionModal?.type === "confirm_milestone" && (
        <ConfirmModal
          actionModal={actionModal}
          actionLoading={actionLoading}
          qcVerified={qcVerifiedByOrder[actionModal.order.contractId]}
          onClose={() => !actionLoading && setActionModal(null)}
          onOpenChecklist={() => {
            setActionModal(null);
            setQcFocus(true);
            setSelectedOrder(actionModal.order);
          }}
          onConfirm={() => handleMilestoneConfirm(actionModal.order)}
        />
      )}

      {/* ══ MODAL: Chi tiết đơn ══ */}
      {selectedOrder && (
        <DetailModal
          order={selectedOrder}
          qcChecked={qcChecked}
          setQcChecked={setQcChecked}
          qcPanelRef={qcPanelRef}
          onClose={closeSelectedOrder}
          onApproveQc={() => {
            setQcVerifiedByOrder((prev) => ({ ...prev, [selectedOrder.contractId]: true }));
            const ord = selectedOrder;
            closeSelectedOrder();
            setQcChecked([false, false, false, false]);
            openConfirm(ord);
          }}
          onConfirmReceipt={() => { const ord = selectedOrder; closeSelectedOrder(); openConfirm(ord); }}
          onDispute={() => { const ord = selectedOrder; closeSelectedOrder(); openDispute(ord); }}
          onDeposit={goDeposit}
          onCreateEscrow={() => { const ord = selectedOrder; closeSelectedOrder(); setActionModal({ order: ord, type: "create_escrow" }); }}
        />
      )}

      {/* ══ MODAL: Khiếu nại ══ */}
      {returnModal && (
        <DisputeModal
          returnModal={returnModal}
          returnReason={returnReason}
          setReturnReason={setReturnReason}
          returnLoading={returnLoading}
          onClose={() => !returnLoading && setReturnModal(null)}
          onSubmit={handleReturnGoods}
        />
      )}

      {/* ══ MODAL: Tạo ký quỹ (fallback) ══ */}
      {actionModal?.type === "create_escrow" && (
        <div className="dh-overlay" onClick={() => !actionLoading && setActionModal(null)}>
          <div className="dh-modal dh-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="dh-mhead">
              <div className="dh-mhead-ic green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <div className="dh-mhead-info"><h3>Tạo ký quỹ</h3><p>{actionModal.order.contractCode}</p></div>
              <CloseBtn onClick={() => !actionLoading && setActionModal(null)} />
            </div>
            <div className="dh-mbody">
              <div className="dh-note amber"><p>Hệ thống sẽ tạo tài khoản ký quỹ cho hợp đồng này. Sau đó vào <strong>Thanh toán trung gian</strong> để nạp số tiền theo hợp đồng.</p></div>
            </div>
            <div className="dh-mfoot">
              <button className="dh-btn ghost" onClick={() => !actionLoading && setActionModal(null)}>Hủy</button>
              <button className="dh-btn primary" disabled={actionLoading} onClick={() => handleCreateEscrow(actionModal.order)}>
                {actionLoading ? "Đang xử lý..." : "Tạo ký quỹ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ORDER LIST ══ */}
      <div className="dh-list">
        {apiOrders === null && (
          <div className="dh-empty"><div className="dh-spinner" /><p>Đang tải đơn hàng...</p></div>
        )}
        {apiOrders !== null && filtered.length === 0 && (
          <div className="dh-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
            <h3>Không có đơn hàng</h3>
            <p>Chưa có đơn hàng nào trong mục này</p>
          </div>
        )}

        {filtered.map((order) => (
          <OrderCard
            key={order.contractId}
            order={order}
            onDetail={() => { setQcFocus(false); setSelectedOrder(order); }}
            onQc={() => { setQcFocus(true); setSelectedOrder(order); }}
            onConfirm={() => openConfirm(order)}
            onDispute={() => openDispute(order)}
            onDeposit={goDeposit}
            onCreateEscrow={() => setActionModal({ order, type: "create_escrow" })}
          />
        ))}
      </div>
    </>
  );
}

/* ──────────────── Sub-components ──────────────── */

function StatCard({ tone, value, label, icon, pulse }) {
  return (
    <div className={`dh-stat dh-stat-${tone}`}>
      <div className={`dh-stat-ic ${pulse ? "pulse" : ""}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </div>
      <div className="dh-stat-body">
        <span className="dh-stat-num">{value}</span>
        <span className="dh-stat-lbl">{label}</span>
      </div>
    </div>
  );
}

function AlertIcon({ kind }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {kind === "check"
        ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
        : <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>}
    </svg>
  );
}

function CloseBtn({ onClick }) {
  return (
    <button className="dh-close" onClick={onClick} aria-label="Đóng">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
    </button>
  );
}

// Thanh tiến trình ngang 5 bước.
function StepRail({ order, compact }) {
  const states = getStepStates(order);
  return (
    <div className={`dh-rail ${compact ? "compact" : ""}`}>
      {STEPS.map((s, i) => {
        const state = states[i];
        return (
          <div key={s.step} className="dh-rail-seg">
            <div className={`dh-rail-step ${state}`}>
              <div className="dh-rail-dot">
                {state === "done"
                  ? <svg viewBox="0 0 12 10" fill="none"><polyline points="1,5 4.5,9 11,1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  : state === "disputed"
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    : <span>{s.step}</span>}
              </div>
              <span className="dh-rail-lbl">{s.short}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`dh-rail-line ${states[i] === "done" ? "done" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order, onDetail, onQc, onConfirm, onDispute, onDeposit, onCreateEscrow }) {
  const meta = STATUS_META[order.status] || { label: order.status, cls: "process" };
  const hint = getActionHint(order);
  return (
    <div className={`dh-card status-${meta.cls}`}>
      <div className="dh-card-accent" />
      <div className="dh-card-main">
        {/* Head */}
        <div className="dh-card-head">
          <div className="dh-card-id">
            <h4>{order.product}</h4>
            <span className="dh-card-supplier">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              {order.supplier}
            </span>
          </div>
          <div className="dh-card-tags">
            {order.paymentTerms && PAYMENT_TERMS_LABELS[order.paymentTerms] && (
              <span className="dh-pill-terms">{PAYMENT_TERMS_LABELS[order.paymentTerms]}</span>
            )}
            <span className={`dh-chip chip-${meta.cls}`}>{meta.label}</span>
          </div>
        </div>

        {/* Info grid */}
        <div className="dh-card-grid">
          <div className="dh-cell"><span>Mã hợp đồng</span><strong className="dh-mono">{order.contractCode}</strong></div>
          <div className="dh-cell"><span>Số lượng</span><strong>{order.quantity}</strong></div>
          <div className="dh-cell"><span>Giá trị</span><strong className="dh-money">{order.value}</strong></div>
          <div className="dh-cell"><span>Dự kiến giao</span><strong>{order.eta}</strong></div>
        </div>

        {/* Step rail */}
        {order.status !== "cancelled" && <StepRail order={order} compact />}

        {/* Hint + actions */}
        <div className="dh-card-foot">
          <span className={`dh-hint tone-${hint.tone}`}>
            <span className="dh-hint-dot" />{hint.text}
          </span>
          <div className="dh-card-actions">
            <button className="dh-btn-sm ghost" onClick={onDetail}>Chi tiết</button>
            {order.canCreateEscrow && <button className="dh-btn-sm info" onClick={onCreateEscrow}>Tạo ký quỹ</button>}
            {order.canDeposit && <button className="dh-btn-sm warn" onClick={onDeposit}>Nạp ký quỹ</button>}
            {order.status === "quality_check" && order.enterpriseCanConfirm && (
              <button className="dh-btn-sm primary" onClick={onQc}>Kiểm tra CL</button>
            )}
            {order.enterpriseCanConfirm && order.status !== "quality_check" && (
              <button className="dh-btn-sm primary" onClick={onConfirm}>Xác nhận</button>
            )}
            {order.canDispute && <button className="dh-btn-sm danger" onClick={onDispute}>Khiếu nại</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ order, qcChecked, setQcChecked, qcPanelRef, onClose, onApproveQc, onConfirmReceipt, onDispute, onDeposit, onCreateEscrow }) {
  const meta = STATUS_META[order.status] || { label: order.status, cls: "process" };
  const QC_ITEMS = [
    { id: 0, label: "Số lượng khớp với hợp đồng", extra: order.quantity },
    { id: 1, label: "Chất lượng sản phẩm đạt tiêu chuẩn cam kết" },
    { id: 2, label: "Bao bì, tem nhãn đầy đủ và không hư hại" },
    { id: 3, label: "Giấy tờ giao hàng hợp lệ" },
  ];
  const checkedCount = qcChecked.filter(Boolean).length;
  const allChecked = qcChecked.every(Boolean);
  const releasePct = order.totalAmount > 0 ? Math.round((order.releasedAmount / order.totalAmount) * 100) : 0;
  const showQc = order.status === "quality_check" && order.escrowStatus !== "none" && order.enterpriseCanConfirm;

  return (
    <div className="dh-overlay" onClick={onClose}>
      <div className={`dh-modal dh-modal-lg detail status-${meta.cls}`} onClick={(e) => e.stopPropagation()}>
        {/* Head */}
        <div className="dh-detail-head">
          <div className="dh-detail-headmain">
            <span className="dh-detail-code">{order.contractCode}</span>
            <h2>{order.product}</h2>
            <span className="dh-detail-supplier">Nhà cung cấp: <strong>{order.supplier}</strong></span>
          </div>
          <div className="dh-detail-headright">
            <span className={`dh-chip chip-${meta.cls}`}>{meta.label}</span>
            <CloseBtn onClick={onClose} />
          </div>
        </div>

        <div className="dh-detail-body">
          {/* Banner trạng thái đặc biệt */}
          {order.status === "disputed" && (
            <div className="dh-note danger"><AlertIcon kind="warn" /><p>Đơn hàng đang trong quá trình khiếu nại. PreOnic đang xem xét và sẽ phân giải trong 3–5 ngày làm việc.</p></div>
          )}
          {order.status === "cancelled" && (
            <div className="dh-note muted"><p>Đơn hàng đã hủy{order.cancelReason ? `: ${order.cancelReason}` : "."}</p></div>
          )}

          {/* 2-col info */}
          <div className="dh-detail-cols">
            <div className="dh-icard">
              <div className="dh-icard-head">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                <span>Thông tin hợp đồng</span>
              </div>
              <div className="dh-irow"><span>Số lượng</span><strong>{order.quantity}</strong></div>
              <div className="dh-irow"><span>Giá trị HĐ</span><strong className="dh-money">{order.value}</strong></div>
              {order.paymentTerms && PAYMENT_TERMS_LABELS[order.paymentTerms] && (
                <div className="dh-irow"><span>Điều khoản</span><strong>{PAYMENT_TERMS_LABELS[order.paymentTerms]}</strong></div>
              )}
              <div className="dh-irow"><span>Dự kiến giao</span><strong>{order.eta}</strong></div>
              <div className="dh-irow last"><span>Ngày tạo HĐ</span><strong>{order.orderDate}</strong></div>
            </div>

            <div className="dh-icard">
              <div className="dh-icard-head">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                <span>Trạng thái ký quỹ</span>
              </div>
              <div className="dh-irow"><span>Trạng thái</span><span className={`dh-esc-chip esc-${order.escrowStatus}`}>{ESCROW_LABELS[order.escrowStatus] || order.escrowStatus}</span></div>
              <div className="dh-irow"><span>Đã nạp</span><strong className="dh-money">{order.depositedAmount.toLocaleString("vi-VN")} ₫</strong></div>
              <div className="dh-irow"><span>Đã giải ngân</span><strong className="dh-money">{order.releasedAmount.toLocaleString("vi-VN")} ₫</strong></div>
              <div className="dh-irow last"><span>Tiến độ giải ngân</span><strong>{releasePct}%</strong></div>
              <div className="dh-esc-bar"><div className="dh-esc-fill" style={{ width: `${releasePct}%` }} /></div>
              {order.canDeposit && <button className="dh-icard-cta" onClick={onDeposit}>Nạp ký quỹ ngay →</button>}
              {order.canCreateEscrow && <button className="dh-icard-cta" onClick={onCreateEscrow}>+ Tạo ký quỹ</button>}
            </div>
          </div>

          {/* Timeline thật từ milestones */}
          <div className="dh-tl-wrap">
            <div className="dh-tl-top">
              <span className="dh-tl-title">Tiến trình đơn hàng</span>
              <span className="dh-tl-count">{order.completedSteps}/{order.totalSteps} mốc hoàn thành</span>
            </div>
            <div className="dh-tl">
              {STEPS.map((s, i) => {
                const m = (order.milestones || []).find((x) => x.step === s.step);
                const state = m
                  ? (m.status === "completed" ? "done" : m.status === "disputed" ? "disputed" : m.status === "in_progress" ? "active" : (order.currentMilestoneStep === s.step ? "active" : "pending"))
                  : (order.currentMilestoneStep === s.step ? "active" : "pending");
                const when = m?.completedAt || m?.enterpriseConfirmedAt || m?.farmerConfirmedAt;
                return (
                  <div key={s.step} className={`dh-tl-item ${state}`}>
                    <div className="dh-tl-marker">
                      <div className="dh-tl-dot">
                        {state === "done"
                          ? <svg viewBox="0 0 12 10" fill="none"><polyline points="1,5 4.5,9 11,1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          : state === "disputed"
                            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            : <span>{s.step}</span>}
                      </div>
                      {i < STEPS.length - 1 && <div className={`dh-tl-vline ${state === "done" ? "done" : ""}`} />}
                    </div>
                    <div className="dh-tl-content">
                      <div className="dh-tl-row">
                        <span className="dh-tl-name">{m?.name || s.label}</span>
                        {state === "active" && <span className="dh-tl-now">Hiện tại</span>}
                        {m && m.releaseAmount > 0 && <span className="dh-tl-amt">+{m.releaseAmount.toLocaleString("vi-VN")} ₫</span>}
                      </div>
                      <span className="dh-tl-desc">{m?.description || s.desc}</span>
                      {when && state === "done" && <span className="dh-tl-when">Hoàn thành: {formatDate(when)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* QC Panel */}
          {showQc && (
            <div className="dh-qc" ref={qcPanelRef}>
              <div className="dh-qc-head">
                <div className="dh-qc-headleft">
                  <div className="dh-qc-ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><polyline points="9 12 11 14 15 10" /></svg>
                  </div>
                  <div><span className="dh-qc-title">Kiểm tra chất lượng hàng hóa</span><span className="dh-qc-sub">Tick đủ các mục trước khi duyệt giải ngân</span></div>
                </div>
                <span className="dh-qc-counter">{checkedCount}/{QC_ITEMS.length}</span>
              </div>
              <div className="dh-qc-prog"><div className={`dh-qc-progfill${allChecked ? " complete" : ""}`} style={{ width: `${(checkedCount / QC_ITEMS.length) * 100}%` }} /></div>
              <ul className="dh-qc-list">
                {QC_ITEMS.map((item) => (
                  <li key={item.id} className={`dh-qc-item ${qcChecked[item.id] ? "checked" : ""}`}
                    onClick={() => setQcChecked((prev) => { const n = [...prev]; n[item.id] = !n[item.id]; return n; })}>
                    <span className="dh-qc-cb">
                      {qcChecked[item.id] && <svg viewBox="0 0 12 10" fill="none"><polyline points="1,5 4.5,9 11,1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span>{item.label}{item.extra && <strong> ({item.extra})</strong>}</span>
                  </li>
                ))}
              </ul>
              <div className="dh-qc-actions">
                <button className={`dh-btn primary grow ${!allChecked ? "is-disabled" : ""}`} disabled={!allChecked} onClick={() => { if (allChecked) onApproveQc(); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Duyệt chất lượng &amp; Giải ngân{!allChecked && <span className="dh-qc-hint">({checkedCount}/{QC_ITEMS.length})</span>}
                </button>
                <button className="dh-btn danger-outline" onClick={onDispute}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  Trả hàng / Khiếu nại
                </button>
              </div>
              <p className="dh-qc-warn"><AlertIcon kind="warn" />Sau khi duyệt, tiền ký quỹ sẽ được giải ngân cho nông dân và không thể hoàn tác.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dh-detail-foot">
          {order.status === "shipping" && order.canDispute && (
            <button className="dh-btn danger-outline" onClick={onDispute}>Trả hàng / Khiếu nại</button>
          )}
          {order.enterpriseCanConfirm && order.status !== "quality_check" && (
            <button className="dh-btn primary" onClick={onConfirmReceipt}>Xác nhận đã nhận hàng</button>
          )}
          <button className="dh-btn ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ actionModal, actionLoading, qcVerified, onClose, onOpenChecklist, onConfirm }) {
  const order = actionModal.order;
  const needChecklist = order.status === "quality_check" && !qcVerified;
  const canConfirm = order.enterpriseCanConfirm;
  return (
    <div className="dh-overlay" onClick={onClose}>
      <div className="dh-modal dh-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="dh-mhead">
          <div className="dh-mhead-ic blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <div className="dh-mhead-info"><h3>Xác nhận mốc thanh toán</h3><p>{order.contractCode}</p></div>
          <CloseBtn onClick={onClose} />
        </div>
        <div className="dh-mbody">
          <div className="dh-ctable">
            <div className="dh-crow"><span>Sản phẩm</span><strong>{order.product}</strong></div>
            <div className="dh-crow"><span>Nhà cung cấp</span><strong>{order.supplier}</strong></div>
            <div className="dh-crow"><span>Giá trị</span><strong className="dh-money">{order.value}</strong></div>
          </div>
          <div className={`dh-note ${needChecklist ? "amber" : "blue"}`}>
            {needChecklist
              ? <p>Đơn đang ở bước <strong>Kiểm tra chất lượng</strong>. Mở chi tiết và tick đủ checklist trước khi xác nhận giải ngân.</p>
              : <p>Xác nhận hàng hóa đạt tiêu chuẩn. Mốc thanh toán sẽ hoàn tất và tiền được giải ngân cho nông dân.</p>}
          </div>
          <div className="dh-warn-row"><AlertIcon kind="warn" />Hành động này không thể hoàn tác. Bạn có chắc chắn không?</div>
        </div>
        <div className="dh-mfoot">
          <button className="dh-btn ghost" onClick={onClose}>Hủy</button>
          <button className={`dh-btn primary ${!canConfirm ? "is-disabled" : ""}`} disabled={actionLoading || !canConfirm}
            onClick={() => { if (needChecklist) { onOpenChecklist(); return; } onConfirm(); }}>
            {actionLoading ? "Đang xử lý..." : !canConfirm ? "Chưa thể xác nhận" : needChecklist ? "Mở checklist CL" : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DisputeModal({ returnModal, returnReason, setReturnReason, returnLoading, onClose, onSubmit }) {
  return (
    <div className="dh-overlay" onClick={onClose}>
      <div className="dh-modal dh-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="dh-mhead">
          <div className="dh-mhead-ic red"><AlertIcon kind="warn" /></div>
          <div className="dh-mhead-info"><h3>Trả hàng / Khiếu nại</h3><p>{returnModal.contractCode} — {returnModal.product}</p></div>
          <CloseBtn onClick={onClose} />
        </div>
        <div className="dh-mbody">
          <div className="dh-note amber"><AlertIcon kind="warn" /><p>Khiếu nại sẽ <strong>tạm dừng toàn bộ giao dịch ký quỹ</strong>. PreOnic sẽ xem xét và phân giải trong <strong>3–5 ngày làm việc</strong>.</p></div>
          <div className="dh-field">
            <label className="dh-field-lbl">Lý do trả hàng / khiếu nại <span className="dh-req">*</span></label>
            <textarea className="dh-textarea" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={4}
              placeholder="Mô tả vấn đề: hàng không đến, không đúng chất lượng, sai số lượng..." />
          </div>
        </div>
        <div className="dh-mfoot">
          <button className="dh-btn ghost" onClick={onClose}>Hủy</button>
          <button className="dh-btn danger" disabled={!returnReason.trim() || returnLoading} onClick={onSubmit}>
            {returnLoading ? "Đang gửi..." : "Gửi khiếu nại"}
          </button>
        </div>
      </div>
    </div>
  );
}
