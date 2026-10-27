// Tách từ EnterpriseDashboard.jsx theo SRP.
import { useState, useEffect, useCallback } from "react";
import enterpriseService from "../../../services/enterprise.service";
import paymentService from "../../../services/payment.service";
import escrowService from "../../../services/escrow.service";

export default function LichSuGiaoDichContent() {
  const [activeTab, setActiveTab] = useState("wallet");
  const [walletTx, setWalletTx] = useState([]);
  const [walletPagination, setWalletPagination] = useState(null);
  const [walletFilter, setWalletFilter] = useState("");
  const [walletPage, setWalletPage] = useState(1);
  const [contracts, setContracts] = useState([]);
  const [contractFilter, setContractFilter] = useState("all");
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [txRes, ctrRes, escRes] = await Promise.all([
          paymentService.getTransactions(1, 20, "").catch(() => null),
          enterpriseService.getContracts().catch(() => null),
          escrowService.list().catch(() => null),
        ]);
        if (txRes?.data?.data) {
          setWalletTx(txRes.data.data.transactions || []);
          setWalletPagination(txRes.data.data.pagination || null);
        }
        if (ctrRes?.data?.contracts) setContracts(ctrRes.data.contracts);
        if (escRes?.escrows) setEscrows(escRes.escrows);
      } catch { /* silent */ }
      setLoading(false);
    };
    loadAll();
  }, []);

  const loadWalletPage = useCallback(async (page, type) => {
    try {
      const res = await paymentService.getTransactions(page, 20, type);
      if (res?.data?.data) {
        setWalletTx(res.data.data.transactions || []);
        setWalletPagination(res.data.data.pagination || null);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!loading && activeTab === "wallet") loadWalletPage(walletPage, walletFilter);
  }, [walletPage, walletFilter]); // eslint-disable-line

  const fmtMoney = v => (v || 0).toLocaleString("vi-VN") + " đ";
  const fmtDate  = d => d ? new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const fmtDT    = d => d ? new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const TX_LABELS = { topup: "Nạp tiền", escrow_deposit: "Ký quỹ", escrow_release: "Giải ngân", refund: "Hoàn tiền", commission: "Phí dịch vụ" };
  const TX_STATUS = { pending: "Đang chờ", completed: "Hoàn thành", failed: "Thất bại", cancelled: "Đã hủy" };
  const TX_CREDIT = ["topup", "escrow_release", "refund"];

  const CTR_STATUS = {
    pending:   { label: "Chờ duyệt",   c: "#f59e0b" },
    active:    { label: "Đang chạy",   c: "#1d4ed8" },
    completed: { label: "Hoàn thành",  c: "#16a34a" },
    cancelled: { label: "Đã hủy",      c: "#ef4444" },
    rejected:  { label: "Từ chối",     c: "#9ca3af" },
  };
  const ESC_STATUS = {
    awaiting_deposit:   { label: "Chờ ký quỹ",      c: "#f59e0b" },
    funded:             { label: "Đã ký quỹ",        c: "#1d4ed8" },
    partially_released: { label: "Đang giải ngân",   c: "#8b5cf6" },
    fully_released:     { label: "Hoàn tất",          c: "#16a34a" },
    refunded:           { label: "Đã hoàn trả",      c: "#6b7280" },
    disputed:           { label: "Tranh chấp",        c: "#ef4444" },
  };

  const filteredContracts = contractFilter === "all" ? contracts : contracts.filter(c => c.status === contractFilter);
  const totalTx  = walletPagination?.total ?? walletTx.length;
  const totalPgs = walletPagination?.pages ?? 1;

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 240, gap: 12, color: "#6b7280", fontSize: 15 }}>
      <div style={{ width: 24, height: 24, border: "3px solid #e5e7eb", borderTopColor: "#1d4ed8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      Đang tải dữ liệu...
    </div>
  );

  return (
    <>
      <div className="breadcrumb"><span>Trang chủ</span><span className="arrow">&gt;</span><span>Lịch sử giao dịch</span></div>
      <h1 className="page-title">Lịch sử hoạt động tài khoản</h1>

      {/* Summary strip */}
      <div className="lsgd-summary">
        <div className="lsgd-sum-item">
          <span className="lsgd-sum-num">{totalTx}</span>
          <span className="lsgd-sum-label">Giao dịch ví</span>
        </div>
        <div className="lsgd-sum-divider" />
        <div className="lsgd-sum-item">
          <span className="lsgd-sum-num">{contracts.length}</span>
          <span className="lsgd-sum-label">Hợp đồng</span>
        </div>
        <div className="lsgd-sum-divider" />
        <div className="lsgd-sum-item">
          <span className="lsgd-sum-num">{escrows.length}</span>
          <span className="lsgd-sum-label">Ký quỹ Escrow</span>
        </div>
        <div className="lsgd-sum-divider" />
        <div className="lsgd-sum-item">
          <span className="lsgd-sum-num">{contracts.filter(c => c.status === "active").length}</span>
          <span className="lsgd-sum-label">HĐ đang chạy</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="lsgd-tabs">
        {[["wallet", "Giao dịch Ví"], ["contracts", "Hợp đồng"], ["escrow", "Thanh toán Escrow"]].map(([k, l]) => (
          <button key={k} className={`lsgd-tab ${activeTab === k ? "active" : ""}`} onClick={() => setActiveTab(k)}>{l}</button>
        ))}
      </div>

      {/* ====== Tab: Wallet Transactions ====== */}
      {activeTab === "wallet" && (
        <div className="lsgd-pane">
          <div className="lsgd-filters">
            {[["", "Tất cả"], ["topup", "Nạp tiền"], ["escrow_deposit", "Ký quỹ"], ["escrow_release", "Giải ngân"], ["refund", "Hoàn tiền"], ["commission", "Phí DV"]].map(([v, lb]) => (
              <button key={v} className={`lsgd-filter ${walletFilter === v ? "active" : ""}`}
                onClick={() => { setWalletFilter(v); setWalletPage(1); }}>{lb}</button>
            ))}
          </div>
          {walletTx.length === 0 ? (
            <div className="lsgd-empty">Chưa có giao dịch nào</div>
          ) : (
            <div className="lsgd-table-wrap">
              <table className="lsgd-table">
                <thead><tr><th>Loại</th><th>Mô tả</th><th>Số tiền</th><th>Số dư sau</th><th>Trạng thái</th><th>Thời gian</th></tr></thead>
                <tbody>
                  {walletTx.map(tx => (
                    <tr key={tx._id}>
                      <td><span className={`lsgd-type-badge ${tx.type}`}>{TX_LABELS[tx.type] || tx.type}</span></td>
                      <td className="lsgd-desc">{tx.description}</td>
                      <td className={`lsgd-amount ${TX_CREDIT.includes(tx.type) ? "credit" : "debit"}`}>
                        {TX_CREDIT.includes(tx.type) ? "+" : "-"}{(tx.amount || 0).toLocaleString("vi-VN")}
                      </td>
                      <td className="lsgd-balance">{tx.balanceAfter != null ? fmtMoney(tx.balanceAfter) : "—"}</td>
                      <td><span className={`lsgd-status ${tx.status}`}>{TX_STATUS[tx.status] || tx.status}</span></td>
                      <td className="lsgd-date">{fmtDT(tx.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPgs > 1 && (
            <div className="lsgd-pagination">
              <button disabled={walletPage <= 1} onClick={() => { const p = walletPage - 1; setWalletPage(p); loadWalletPage(p, walletFilter); }}>‹ Trước</button>
              <span>Trang {walletPage} / {totalPgs}</span>
              <button disabled={walletPage >= totalPgs} onClick={() => { const p = walletPage + 1; setWalletPage(p); loadWalletPage(p, walletFilter); }}>Sau ›</button>
            </div>
          )}
        </div>
      )}

      {/* ====== Tab: Contracts ====== */}
      {activeTab === "contracts" && (
        <div className="lsgd-pane">
          <div className="lsgd-filters">
            {[["all", "Tất cả"], ["pending", "Chờ duyệt"], ["active", "Đang chạy"], ["completed", "Hoàn thành"], ["cancelled", "Đã hủy"]].map(([v, lb]) => (
              <button key={v} className={`lsgd-filter ${contractFilter === v ? "active" : ""}`}
                onClick={() => setContractFilter(v)}>
                {lb}
                {v !== "all" && <span className="lsgd-filter-count">{contracts.filter(c => c.status === v).length}</span>}
              </button>
            ))}
          </div>
          {filteredContracts.length === 0 ? (
            <div className="lsgd-empty">Chưa có hợp đồng nào</div>
          ) : (
            <div className="lsgd-table-wrap">
              <table className="lsgd-table">
                <thead><tr><th>Mã HĐ</th><th>Nông dân</th><th>Sản phẩm</th><th>Giá trị</th><th>Trạng thái</th><th>Ngày tạo</th><th>Ngày giao</th></tr></thead>
                <tbody>
                  {filteredContracts.map((c, i) => {
                    const sm = CTR_STATUS[c.status] || { label: c.status, c: "#9ca3af" };
                    return (
                      <tr key={c._id || i}>
                        <td className="lsgd-code">{c.contractCode || `#${String(c._id || "").slice(-6).toUpperCase()}`}</td>
                        <td>{c.farmerName || "—"}</td>
                        <td>{c.productName || "—"}</td>
                        <td className="lsgd-amount credit">{fmtMoney(c.totalValue || 0)}</td>
                        <td><span className="lsgd-status-badge" style={{ background: sm.c + "22", color: sm.c }}>{sm.label}</span></td>
                        <td className="lsgd-date">{fmtDate(c.createdAt)}</td>
                        <td className="lsgd-date">{fmtDate(c.deliveryDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ====== Tab: Escrow ====== */}
      {activeTab === "escrow" && (
        <div className="lsgd-pane">
          {escrows.length === 0 ? (
            <div className="lsgd-empty">Chưa có giao dịch ký quỹ nào</div>
          ) : (
            <div className="lsgd-table-wrap">
              <table className="lsgd-table">
                <thead><tr><th>Hợp đồng</th><th>Đã ký quỹ</th><th>Đã giải ngân</th><th>Còn lại</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead>
                <tbody>
                  {escrows.map((e, i) => {
                    const sm = ESC_STATUS[e.status] || { label: e.status, c: "#9ca3af" };
                    const held = (e.depositedAmount || 0) - (e.releasedAmount || 0);
                    return (
                      <tr key={e._id || i}>
                        <td className="lsgd-code">{e.contractCode || (e.contractId ? `#${String(e.contractId).slice(-6).toUpperCase()}` : "—")}</td>
                        <td className="lsgd-amount debit">{fmtMoney(e.depositedAmount || 0)}</td>
                        <td className="lsgd-amount credit">{fmtMoney(e.releasedAmount || 0)}</td>
                        <td className="lsgd-balance">{fmtMoney(held)}</td>
                        <td><span className="lsgd-status-badge" style={{ background: sm.c + "22", color: sm.c }}>{sm.label}</span></td>
                        <td className="lsgd-date">{fmtDate(e.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
