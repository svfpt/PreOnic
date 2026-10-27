import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import paymentService from "../../services/payment.service";
import { formatMoney } from "../../hooks/useApiData";
import { GATEWAY_MIN_TOPUP, TOPUP_PRESETS } from "../../constants";
import WithdrawTab from "./WithdrawTab";
import "./WalletPayment.css";

const TRANSACTION_PAGE_SIZE = 20;
const DEMO_MIN_TOPUP = 1000;

const WALLET_TABS = [
  { key: "overview", label: "Tổng quan" },
  { key: "topup", label: "Nạp tiền" },
  { key: "withdraw", label: "Rút tiền" },
  { key: "history", label: "Lịch sử" },
];

const HISTORY_FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "topup", label: "Nạp tiền" },
  { key: "escrow_deposit", label: "Ký quỹ" },
  { key: "escrow_release", label: "Giải ngân" },
  { key: "refund", label: "Hoàn tiền" },
];

const GUIDE_STEPS = [
  {
    n: "1",
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 20, height: 20 }}><rect x="3" y="2" width="14" height="16" rx="2" /><path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round" /></svg>,
    title: "Nạp tiền vào ví",
    desc: "Tạo lệnh SePay, chuyển khoản đúng nội dung và chờ hệ thống tự cộng ví qua webhook",
  },
  {
    n: "2",
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 20, height: 20 }}><rect x="3" y="9" width="14" height="8" rx="2" /><path d="M7 9V7a3 3 0 016 0v2" strokeLinecap="round" /></svg>,
    title: "Ký quỹ hợp đồng",
  },
  {
    n: "3",
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 20, height: 20 }}><path d="M4 10h12M10 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    title: "Giải ngân tự động",
    desc: "Tiền giải ngân khi cả hai bên xác nhận mốc thanh toán theo tiến độ",
  },
];

const TYPE_LABELS = {
  topup: "Nạp tiền",
  escrow_deposit: "Ký quỹ",
  escrow_release: "Giải ngân",
  refund: "Hoàn tiền",
  commission: "Phí dịch vụ",
};

const STATUS_LABELS = {
  pending: "Đang chờ",
  completed: "Thành công",
  failed: "Thất bại",
  cancelled: "Đã hủy",
};

const formatDateTime = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isPositiveTransaction = (type) => ["topup", "escrow_release", "refund"].includes(type);

const formatPresetLabel = (amount) => (
  amount >= 1000000000
    ? `${(amount / 1000000000).toFixed(amount % 1000000000 === 0 ? 0 : 1)} tỷ`
    : `${(amount / 1000000).toFixed(0)} triệu`
);

export default function WalletPayment({ role }) {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [createdTopup, setCreatedTopup] = useState(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [txFilter, setTxFilter] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [verifyState, setVerifyState] = useState(null); // 'loading'|'success'|'failed'|'cancelled'
  const [returnOrderCode, setReturnOrderCode] = useState(null);
  const [cancellingCode, setCancellingCode] = useState(null);
  const { user } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const loadWallet = useCallback(async () => {
    try {
      const res = await paymentService.getWallet();
      if (res.data?.data) setWallet(res.data.data);
    } catch {
      toastError("Không thể tải thông tin ví");
    }
  }, [toastError]);

  const loadTransactions = useCallback(async (page = 1, type = "") => {
    try {
      const res = await paymentService.getTransactions(page, TRANSACTION_PAGE_SIZE, type);
      if (res.data?.data) {
        setTransactions(res.data.data.transactions || []);
        setPagination(res.data.data.pagination || null);
      }
    } catch { /* silent */ }
  }, []);

  // Khối helper này gom việc làm mới dữ liệu ví và xác minh giao dịch để không lặp lại ở nhiều handler.
  const refreshWalletData = useCallback(async (page = 1, type = "") => {
    await loadWallet();
    await loadTransactions(page, type);
  }, [loadTransactions, loadWallet]);

  const verifyTopupOrder = useCallback(async (orderCode) => {
    setReturnOrderCode(String(orderCode));
    setVerifyState("loading");

    try {
      const res = await paymentService.verifyTopup(String(orderCode));
      if (res.data?.data?.success) {
        setVerifyState("success");
        setCreatedTopup(null);
        await refreshWalletData(1, "");
      } else if (res.data?.data?.status === "pending") {
        setVerifyState("pending");
      } else if (res.data?.data?.status === "cancelled") {
        setVerifyState("cancelled");
      } else {
        setVerifyState("failed");
      }
    } catch {
      setVerifyState("failed");
    }
  }, [refreshWalletData]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadWallet(), loadTransactions()]);
      setLoading(false);
    };
    init();
  }, [loadWallet, loadTransactions]);

  useEffect(() => {
    if (activeTab === "history") {
      loadTransactions(txPage, txFilter);
    }
  }, [activeTab, txPage, txFilter, loadTransactions]);

  // Giữ khả năng đọc tham số trả về từ gateway để không phải đổi luồng khi bật SePay sau này.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderCode = params.get("orderCode");
    const statusParam = params.get("status");
    const cancelParam = params.get("cancel");
    if (!orderCode) return;
    window.history.replaceState({}, "", window.location.pathname);
    setReturnOrderCode(orderCode);
    setActiveTab("topup");
    if (cancelParam === "true" || statusParam === "CANCELLED") {
      setVerifyState("cancelled");
      paymentService.cancelTopup(orderCode).catch(() => {});
    } else {
      verifyTopupOrder(orderCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Khối handler bên dưới chịu trách nhiệm nạp tiền, hủy giao dịch và cập nhật lại trạng thái ví theo từng thao tác.
  /* ====== TOP-UP HANDLERS ====== */
  const handleGatewayTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount < GATEWAY_MIN_TOPUP) {
      toastError("Số tiền tối thiểu là 10.000 VND");
      return;
    }

    setTopupLoading(true);
    try {
      const res = await paymentService.createTopup(amount);
      const topupData = res.data?.data;
      if (!topupData) {
        toastError("Không thể tạo yêu cầu nạp tiền qua SePay");
        return;
      }

      setCreatedTopup(topupData);
      setReturnOrderCode(String(topupData.orderCode));
      setVerifyState("pending");
      toastSuccess("Đã tạo yêu cầu nạp tiền qua SePay. Hãy chuyển khoản đúng nội dung để hệ thống tự cộng ví.");
    } catch (err) {
      toastError(err.response?.data?.message || "Không thể tạo yêu cầu nạp tiền qua SePay");
    } finally {
      setTopupLoading(false);
    }
  };

  const handleDemoTopup = async () => {
    const amount = Number(topupAmount);
    if (!Number.isSafeInteger(amount) || amount < DEMO_MIN_TOPUP) {
      toastError("Số tiền nạp demo tối thiểu là 1.000 VND");
      return;
    }

    setTopupLoading(true);
    try {
      const res = await paymentService.demoTopup(amount);
      if (!res.data?.data) {
        toastError("Không nhận được kết quả nạp demo từ máy chủ");
        return;
      }

      setCreatedTopup(null);
      toastSuccess(`Nạp demo thành công +${formatMoney(amount)}! Đây là tiền ảo, không có giá trị thanh toán thực tế.`);
      setTopupAmount("");
      setTxFilter("topup");
      setTxPage(1);
      setActiveTab("history");
      await refreshWalletData(1, "topup");
    } catch (err) {
      toastError(err.response?.data?.message || "Lỗi nạp demo");
    } finally {
      setTopupLoading(false);
    }
  };

  const handleCancelTopup = async (orderCode) => {
    setCancellingCode(String(orderCode));
    try {
      await paymentService.cancelTopup(orderCode);
      toastSuccess("Đã hủy giao dịch nạp tiền");
      await refreshWalletData(1, txFilter);
    } catch (err) {
      toastError(err?.response?.data?.message || "Hủy thất bại");
    } finally {
      setCancellingCode(null);
    }
  };

  const handleVerify = async (orderCode) => {
    await verifyTopupOrder(orderCode);
  };

  const copyText = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(String(value));
      toastSuccess(successMessage);
    } catch {
      toastError("Không thể sao chép. Vui lòng thử lại.");
    }
  };

  if (loading) {
    return (
      <div className="wlt-loading">
        <div className="wlt-spinner" />
        <p>Đang tải ví...</p>
      </div>
    );
  }

  const balance = wallet?.balance || user?.virtualBalance || 0;
  const stats = wallet?.stats || {};
  const pendingTopups = (wallet?.recentTransactions || []).filter(
    (tx) => tx.type === "topup" && tx.status === "pending" && tx.orderCode
  );

  const TxIcon = ({ type }) => {
    const s = { width: 18, height: 18 };
    if (type === "topup")          return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={s}><path d="M10 4v12M4 10h12" strokeLinecap="round"/></svg>;
    if (type === "escrow_deposit") return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={s}><rect x="3" y="9" width="14" height="8" rx="2"/><path d="M7 9V7a3 3 0 016 0v2" strokeLinecap="round"/></svg>;
    if (type === "escrow_release") return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={s}><path d="M4 10h12M10 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if (type === "refund")         return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={s}><path d="M8 5l-4 4 4 4M4 9h9a3 3 0 010 6H9" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if (type === "commission")     return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={s}><path d="M4 4h12v12H4z"/><path d="M8 8h4M8 12h4" strokeLinecap="round"/></svg>;
    return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={s}><path d="M10 2L3 14h14L10 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  };

  return (
    <div className="wlt-container">

      {/* ── VERIFY RESULT BANNER (global, shown on any tab) ── */}
      {verifyState && (
        <div className={`wlt-verify-banner wlt-verify-${verifyState}`}>
          {verifyState === "loading" && <><span className="wlt-vspin" /><div><strong>Đang xác minh thanh toán…</strong><p>Vui lòng chờ trong giây lát</p></div></>}
          {verifyState === "success" && <><span className="wlt-vicon wlt-vi-ok">✓</span><div><strong>Nạp tiền thành công!</strong><p>Số dư ví đã được cộng{returnOrderCode ? ` — Mã GD: ${returnOrderCode}` : ""}.</p></div><button className="wlt-vdismiss" onClick={() => setVerifyState(null)}>✕</button></>}
          {verifyState === "failed"  && <><span className="wlt-vicon wlt-vi-err">✗</span><div><strong>Xác minh thất bại</strong><p>Nếu tiền đã bị trừ, liên hệ hỗ trợ với mã: {returnOrderCode}</p></div><button className="wlt-vdismiss" onClick={() => setVerifyState(null)}>✕</button></>}
          {verifyState === "cancelled" && <><span className="wlt-vicon wlt-vi-warn">!</span><div><strong>Giao dịch đã hủy</strong><p>Bạn đã hủy phiên thanh toán. Không có tiền nào bị trừ.</p></div><button className="wlt-vdismiss" onClick={() => setVerifyState(null)}>✕</button></>}
          {verifyState === "pending" && <><span className="wlt-vicon wlt-vi-warn">!</span><div><strong>Chưa xác nhận</strong><p>Giao dịch đang chờ SePay xác nhận chuyển khoản.</p></div><button className="wlt-vdismiss" onClick={() => setVerifyState(null)}>✕</button></>}
        </div>
      )}

      {/* ── HERO BALANCE CARD ── */}
      <div className={`wlt-hero ${role === "farmer" ? "wlt-hero-farmer" : "wlt-hero-enterprise"}`}>
        <div className="wlt-hero-left">
          <div className="wlt-hero-eyebrow">
            <span className="wlt-hero-dot" />
            {role === "farmer" ? "Ví Nông dân • PreOnic" : "Ví Doanh nghiệp • PreOnic"}
          </div>
          <div className="wlt-hero-balance-label">Số dư khả dụng</div>
          <div className="wlt-hero-balance">{formatMoney(balance)}</div>
          <div className="wlt-hero-note">
            {role === "farmer"
              ? "Nhận tự động khi doanh nghiệp xác nhận mốc giao hàng"
              : "Dùng để ký quỹ và thanh toán các hợp đồng bao tiêu"}
          </div>
          <button
            className="wlt-hero-topup-btn"
            onClick={() => setActiveTab("topup")}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}><path d="M10 4v12M4 10h12" strokeLinecap="round"/></svg>
            Nạp tiền ngay
          </button>
        </div>
        <div className="wlt-hero-right">
          <div className="wlt-hero-stat">
            <div className="wlt-hero-stat-icon wlt-hs-green">↑</div>
            <div>
              <div className="wlt-hero-stat-label">Tổng nạp</div>
              <div className="wlt-hero-stat-val">{formatMoney(stats.totalTopup)}</div>
            </div>
          </div>
          <div className="wlt-hero-stat">
            <div className="wlt-hero-stat-icon wlt-hs-red">↓</div>
            <div>
              <div className="wlt-hero-stat-label">Tổng chi</div>
              <div className="wlt-hero-stat-val">{formatMoney(stats.totalSpent)}</div>
            </div>
          </div>
          <div className="wlt-hero-stat">
            <div className="wlt-hero-stat-icon wlt-hs-blue">≡</div>
            <div>
              <div className="wlt-hero-stat-label">Giao dịch</div>
              <div className="wlt-hero-stat-val">{wallet?.recentTransactions?.length || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="wlt-tab-bar">
        {WALLET_TABS.map((t) => (
          <button
            key={t.key}
            className={`wlt-tab-btn ${activeTab === t.key ? "wlt-tab-active" : ""}`}
            onClick={() => { setActiveTab(t.key); if (t.key === "history") setTxPage(1); }}
          >
            <span className="wlt-tab-icon">
              {t.key === "overview" && <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 15, height: 15 }}><path d="M3 3h6v6H3zm8 0h6v6h-6zM3 11h6v6H3zm8 0h6v6h-6z"/></svg>}
              {t.key === "topup"    && <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 15, height: 15 }}><path d="M10 4v12M4 10h12" strokeLinecap="round"/></svg>}
              {t.key === "withdraw" && <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 15, height: 15 }}><path d="M10 16V4M4 10l6-6 6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {t.key === "history"  && <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 15, height: 15 }}><circle cx="10" cy="10" r="7"/><path d="M10 7v3l3 2" strokeLinecap="round"/></svg>}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ TAB: WITHDRAW ══════════ */}
      {activeTab === "withdraw" && (
        <WithdrawTab onChanged={loadWallet} />
      )}

      {/* ══════════ TAB: OVERVIEW ══════════ */}
      {activeTab === "overview" && (
        <div className="wlt-body">

          {/* Pending topups */}
          {pendingTopups.length > 0 && (
            <div className="wlt-card wlt-pending-card">
              <div className="wlt-card-head">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 18, height: 18, color: '#92400e' }}><path d="M5 3h10M5 17h10M7 3v5l-2 4 2 4M13 3v5l2 4-2 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <h3>Giao dịch đang chờ ({pendingTopups.length})</h3>
              </div>
              {pendingTopups.map((tx) => (
                <div key={tx._id} className="wlt-pending-row">
                  <div className="wlt-pending-row-left">
                    <div className="wlt-tx-icon-wrap wlt-tx-topup"><TxIcon type="topup" /></div>
                    <div>
                      <div className="wlt-pending-amt">+{formatMoney(tx.amount)}</div>
                      <div className="wlt-pending-time">{formatDateTime(tx.createdAt)}</div>
                    </div>
                  </div>
                  <div className="wlt-pending-row-actions">
                    <button className="wlt-action-btn wlt-action-verify" onClick={() => handleVerify(tx.orderCode)}>Xác minh</button>
                    <button
                      className="wlt-action-btn wlt-action-cancel"
                      disabled={cancellingCode === String(tx.orderCode)}
                      onClick={() => handleCancelTopup(tx.orderCode)}
                    >{cancellingCode === String(tx.orderCode) ? "..." : "Hủy"}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="wlt-overview-grid">
            {/* Recent transactions */}
            <div className="wlt-card wlt-tx-card">
              <div className="wlt-card-head">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 18, height: 18 }}><circle cx="10" cy="10" r="7"/><path d="M10 7v3l3 2" strokeLinecap="round"/></svg>
                <h3>Giao dịch gần đây</h3>
                <button className="wlt-card-head-link" onClick={() => { setActiveTab("history"); setTxPage(1); }}>Xem tất cả →</button>
              </div>
              {(!wallet?.recentTransactions || wallet.recentTransactions.length === 0) ? (
                <div className="wlt-empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 40, height: 40, color: '#d1d5db', marginBottom: 8 }}><rect x="2" y="6" width="20" height="13" rx="3"/><path d="M2 11h20M6 15h4"/></svg>
                  <p>Chưa có giao dịch nào</p>
                  <button className="wlt-empty-action" onClick={() => setActiveTab("topup")}>Nạp tiền ngay</button>
                </div>
              ) : (
                <div className="wlt-tx-feed">
                  {wallet.recentTransactions.map((tx) => (
                    <div key={tx._id} className="wlt-tx-feed-row">
                      <div className={`wlt-tx-icon-wrap wlt-tx-${tx.type}`}>
                        <TxIcon type={tx.type} />
                      </div>
                      <div className="wlt-tx-feed-info">
                        <div className="wlt-tx-feed-type">{TYPE_LABELS[tx.type] || tx.type}</div>
                        <div className="wlt-tx-feed-desc">{tx.description}</div>
                        <div className="wlt-tx-feed-time">{formatDateTime(tx.createdAt)}</div>
                      </div>
                      <div className="wlt-tx-feed-right">
                        <div className={`wlt-tx-feed-amt ${isPositiveTransaction(tx.type) ? "wlt-amt-pos" : "wlt-amt-neg"}`}>
                          {isPositiveTransaction(tx.type) ? "+" : "−"}{tx.amount?.toLocaleString("vi-VN")}
                        </div>
                        <span className={`wlt-status-pill wlt-status-${tx.status}`}>{STATUS_LABELS[tx.status]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="wlt-card wlt-guide-card">
              <div className="wlt-card-head">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 18, height: 18 }}><path d="M3 5a2 2 0 012-2h5v14H5a2 2 0 01-2-2V5z"/><path d="M10 3h5a2 2 0 012 2v10a2 2 0 01-2 2h-5V3z"/></svg>
                <h3>Cách hoạt động</h3>
              </div>
              <div className="wlt-guide-steps">
                {GUIDE_STEPS.map((step) => {
                  const description = step.title === "Ký quỹ hợp đồng"
                    ? (role === "farmer"
                      ? "Doanh nghiệp ký quỹ — tiền được giữ an toàn trong hệ thống PreOnic"
                      : "Dùng tiền ảo để ký quỹ đảm bảo thực hiện hợp đồng bao tiêu")
                    : step.desc;

                  return (
                  <div className="wlt-guide-row" key={step.n}>
                    <div className="wlt-guide-bubble">{step.n}</div>
                    <div className="wlt-guide-icon-wrap">{step.icon}</div>
                    <div className="wlt-guide-text">
                      <strong>{step.title}</strong>
                      <p>{description}</p>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="wlt-security-banner">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 16, height: 16, flexShrink: 0 }}><path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z" strokeLinejoin="round"/></svg>
                <span>Mọi giao dịch được mã hóa và bảo vệ bởi hệ thống escrow PreOnic</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ TAB: TOP-UP ══════════ */}
      {activeTab === "topup" && (
        <div className="wlt-body">

          <div className="wlt-topup-layout">
            {/* Left: form */}
            <div className="wlt-card wlt-topup-form-card">
              <div className="wlt-card-head">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 18, height: 18 }}><path d="M10 4v12M4 10h12" strokeLinecap="round"/></svg>
                <h3>Nạp tiền vào ví</h3>
              </div>

              {/* Steps */}
              <div className="wlt-flow-steps">
                {["Chọn số tiền", "Thanh toán", "Tiền vào ví"].map((s, i) => (
                  <div className="wlt-flow-step" key={i}>
                    <div className="wlt-flow-num">{i + 1}</div>
                    <span>{s}</span>
                    {i < 2 && <div className="wlt-flow-line" />}
                  </div>
                ))}
              </div>

              {/* Presets */}
              <div className="wlt-topup-label">Chọn nhanh</div>
              <div className="wlt-preset-grid">
                    {TOPUP_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    className={`wlt-preset-chip ${Number(topupAmount) === amt ? "wlt-preset-active" : ""}`}
                    onClick={() => setTopupAmount(String(amt))}
                  >
                    {formatPresetLabel(amt)}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className="wlt-topup-label" style={{ marginTop: 20 }}>Hoặc nhập tùy chỉnh</div>
              <div className="wlt-amount-input-wrap">
                <span className="wlt-amount-prefix">₫</span>
                <input
                  className="wlt-amount-input"
                  type="number"
                  placeholder="0"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  min="1000"
                  max="999000000000000"
                />
                <span className="wlt-amount-suffix">VND</span>
              </div>
              {topupAmount && Number(topupAmount) > 0 && (
                <div className="wlt-balance-preview">
                  <span>Số dư sau nạp</span>
                  <strong>{formatMoney(balance + Number(topupAmount))}</strong>
                </div>
              )}

              {/* Buttons */}
              <div className="wlt-topup-btns">
                <button
                  className="wlt-btn-gateway"
                  onClick={handleGatewayTopup}
                  disabled={topupLoading || !topupAmount || Number(topupAmount) < GATEWAY_MIN_TOPUP}
                >
                  {topupLoading ? <span className="wlt-bspin" /> : <><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 17, height: 17 }}><path d="M3 8l7-5 7 5H3z"/><path d="M5 8v7m4-7v7m4-7v7M3 15h14" strokeLinecap="round"/></svg> Tạo lệnh SePay</>}
                </button>
                <button
                  className="wlt-btn-demo"
                  onClick={handleDemoTopup}
                  disabled={topupLoading || !topupAmount || Number(topupAmount) < DEMO_MIN_TOPUP}
                >
                  {topupLoading ? <span className="wlt-bspin" /> : <><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 17, height: 17 }}><path d="M11 2L4 12h7l-2 6 9-10h-7L11 2z" strokeLinejoin="round"/></svg> Nạp demo (tức thì)</>}
                </button>
                <p className="wlt-demo-notice">Nạp demo chỉ cộng tiền ảo phục vụ thử nghiệm, không phải giao dịch thật.</p>
              </div>

              {createdTopup && (
                <div className="wlt-sepay-card">
                  <div className="wlt-sepay-head">
                    <div>
                      <strong>Thông tin chuyển khoản SePay</strong>
                      <p>Quét mã QR hoặc chuyển khoản thủ công đúng nội dung bên dưới.</p>
                    </div>
                    <span className="wlt-sepay-pill">Đang chờ</span>
                  </div>

                  <div className="wlt-sepay-grid">
                    <div className="wlt-sepay-qr-wrap">
                      <img
                        className="wlt-sepay-qr"
                        src={createdTopup.qrCodeUrl}
                        alt={`QR SePay ${createdTopup.orderCode}`}
                      />
                    </div>

                    <div className="wlt-sepay-details">
                      <div className="wlt-sepay-row">
                        <span>Ngân hàng</span>
                        <strong>{createdTopup.bankInfo?.bankCode}</strong>
                      </div>
                      <div className="wlt-sepay-row">
                        <span>Số tài khoản</span>
                        <strong>{createdTopup.bankInfo?.accountNumber}</strong>
                      </div>
                      <div className="wlt-sepay-row">
                        <span>Chủ tài khoản</span>
                        <strong>{createdTopup.bankInfo?.accountName}</strong>
                      </div>
                      <div className="wlt-sepay-row">
                        <span>Số tiền</span>
                        <strong>{formatMoney(createdTopup.amount)}</strong>
                      </div>
                      <div className="wlt-sepay-row wlt-sepay-row-code">
                        <span>Nội dung CK</span>
                        <strong>{createdTopup.transferCode}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="wlt-sepay-actions">
                    <button
                      className="wlt-sepay-btn"
                      onClick={() => copyText(createdTopup.bankInfo?.accountNumber, "Đã sao chép số tài khoản")}
                    >
                      Sao chép STK
                    </button>
                    <button
                      className="wlt-sepay-btn"
                      onClick={() => copyText(createdTopup.transferCode, "Đã sao chép nội dung chuyển khoản")}
                    >
                      Sao chép nội dung
                    </button>
                    <button
                      className="wlt-sepay-btn wlt-sepay-btn-primary"
                      onClick={() => handleVerify(createdTopup.orderCode)}
                    >
                      Kiểm tra trạng thái
                    </button>
                  </div>

                  <p className="wlt-sepay-note">{createdTopup.note}</p>
                </div>
              )}
            </div>

            {/* Right: info */}
            <div className="wlt-topup-side">
              <div className="wlt-card wlt-info-card">
                <div className="wlt-card-head">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 18, height: 18 }}><circle cx="10" cy="10" r="7"/><path d="M10 9v4M10 7h.01" strokeLinecap="round"/></svg>
                  <h3>Thông tin nạp tiền</h3>
                </div>
                <div className="wlt-info-rows">
                  <div className="wlt-info-row wlt-info-gateway">
                    <div className="wlt-info-row-icon"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 22, height: 22 }}><path d="M3 8l7-5 7 5H3z"/><path d="M5 8v7m4-7v7m4-7v7M3 15h14" strokeLinecap="round"/></svg></div>
                    <div>
                      <strong>SePay — Chuyển khoản tự động</strong>
                      <p>Tạo lệnh nạp tiền, chuyển khoản đúng nội dung, SePay sẽ gửi webhook để hệ thống cộng ví tự động.</p>
                    </div>
                  </div>
                  {/* Mục thông tin "Demo" tạm ẩn — bỏ comment để kích hoạt lại sau. */}
                  {/* <div className="wlt-info-divider" />
                  <div className="wlt-info-row wlt-info-demo">
                    <div className="wlt-info-row-icon"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 22, height: 22 }}><path d="M11 2L4 12h7l-2 6 9-10h-7L11 2z" strokeLinejoin="round"/></svg></div>
                    <div>
                      <strong>Demo — Miễn phí</strong>
                      <p>Nạp tức thì, không cần thanh toán — dùng để trải nghiệm và kiểm thử hệ thống.</p>
                    </div>
                  </div> */}
                </div>
              </div>

              <div className="wlt-card wlt-security-card">
                <div className="wlt-card-head">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 18, height: 18 }}><path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z" strokeLinejoin="round"/></svg>
                  <h3>Bảo mật & An toàn</h3>
                </div>
                <div className="wlt-security-list">
                  {["Giao dịch được mã hóa SSL 256-bit", "Tiền ký quỹ không thể rút đơn phương", "SePay xác minh tự động qua webhook khi chuyển khoản thành công", "Hoàn tiền đầy đủ nếu tranh chấp"].map((s) => (
                    <div className="wlt-security-item" key={s}>
                      <span className="wlt-security-check">✓</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ TAB: HISTORY ══════════ */}
      {activeTab === "history" && (
        <div className="wlt-body">
          <div className="wlt-card">
            <div className="wlt-card-head">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 18, height: 18 }}><path d="M6 2h8a1 1 0 011 1v14a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M8 6h4M8 10h4M8 14h2" strokeLinecap="round"/></svg>
              <h3>Lịch sử giao dịch</h3>
            </div>

            {/* Filter pills */}
            <div className="wlt-filter-row">
              {HISTORY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={`wlt-filter-pill ${txFilter === f.key ? "wlt-filter-active" : ""}`}
                  onClick={() => { setTxFilter(f.key); setTxPage(1); }}
                >{f.label}</button>
              ))}
            </div>

            {transactions.length === 0 ? (
              <div className="wlt-empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 48, height: 48, color: '#d1d5db', marginBottom: 8 }}><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></svg>
                <p>Không có giao dịch nào</p>
              </div>
            ) : (
              <>
                {/* Header row */}
                <div className="wlt-hist-header">
                  <span>Loại</span>
                  <span>Chi tiết</span>
                  <span style={{ textAlign: "right" }}>Số tiền</span>
                  <span style={{ textAlign: "right" }}>Số dư sau</span>
                  <span style={{ textAlign: "center" }}>Trạng thái</span>
                  <span>Thời gian</span>
                </div>

                {transactions.map((tx, i) => (
                  <div key={tx._id} className={`wlt-hist-row ${i % 2 === 0 ? "wlt-hist-even" : ""}`}>
                    <div className="wlt-hist-type">
                      <div className={`wlt-tx-icon-wrap wlt-tx-${tx.type}`}><TxIcon type={tx.type} /></div>
                      <span>{TYPE_LABELS[tx.type] || tx.type}</span>
                    </div>
                    <span className="wlt-hist-desc" title={tx.description}>{tx.description}</span>
                    <span className={`wlt-hist-amt ${isPositiveTransaction(tx.type) ? "wlt-amt-pos" : "wlt-amt-neg"}`}>
                      {isPositiveTransaction(tx.type) ? "+" : "−"}{tx.amount?.toLocaleString("vi-VN")}
                    </span>
                    <span className="wlt-hist-balance">{tx.balanceAfter?.toLocaleString("vi-VN") ?? "—"}</span>
                    <span style={{ textAlign: "center" }}>
                      <span className={`wlt-status-pill wlt-status-${tx.status}`}>{STATUS_LABELS[tx.status]}</span>
                    </span>
                    <span className="wlt-hist-date">{formatDateTime(tx.createdAt)}</span>
                  </div>
                ))}

                {pagination && pagination.totalPages > 1 && (
                  <div className="wlt-pager">
                    <button className="wlt-pager-btn" disabled={txPage <= 1} onClick={() => setTxPage(txPage - 1)}>← Trước</button>
                    <span className="wlt-pager-info">Trang {txPage} / {pagination.totalPages}</span>
                    <button className="wlt-pager-btn" disabled={txPage >= pagination.totalPages} onClick={() => setTxPage(txPage + 1)}>Sau →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
