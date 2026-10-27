import { useEffect, useState, useCallback } from "react";
import adminService from "../../../services/admin.service";
import { formatMoney } from "../../../hooks/useApiData";
import { useToast } from "../../../contexts/ToastContext";

const TYPE_META = {
  topup:           { label: "Nạp tiền",  cls: "adm-badge-green"  },
  escrow_deposit:  { label: "Ký quỹ",    cls: "adm-badge-blue"   },
  escrow_release:  { label: "Giải ngân", cls: "adm-badge-purple" },
  refund:          { label: "Hoàn tiền", cls: "adm-badge-yellow" },
  commission:      { label: "Hoa hồng", cls: "adm-badge-gray"   },
};

const STATUS_META = {
  completed: { label: "Hoàn thành", cls: "adm-badge-green" },
  pending:   { label: "Đang chờ",   cls: "adm-badge-yellow" },
  failed:    { label: "Thất bại",   cls: "adm-badge-red" },
  cancelled: { label: "Đã hủy",    cls: "adm-badge-gray" },
};

const METHOD_LABELS = {
  sepay: "SePay", internal: "Nội bộ", demo: "Demo",
};

const TYPE_OPTIONS = [
  { val: "", label: "Tất cả loại" },
  { val: "topup", label: "Nạp tiền" },
  { val: "escrow_deposit", label: "Ký quỹ" },
  { val: "escrow_release", label: "Giải ngân" },
  { val: "refund", label: "Hoàn tiền" },
  { val: "commission", label: "Hoa hồng" },
];

const STATUS_OPTIONS = [
  { val: "", label: "Tất cả trạng thái" },
  { val: "completed", label: "Hoàn thành" },
  { val: "pending", label: "Đang chờ" },
  { val: "failed", label: "Thất bại" },
  { val: "cancelled", label: "Đã hủy" },
];

export default function QuanLyGiaoDich() {
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await adminService.getTransactions(params);
      setTransactions(res?.data || []);
      if (res?.pagination) setPagination(res.pagination);
      if (res?.stats) setStats(res.stats);
    } catch {
      toast.error("Không thể tải danh sách giao dịch");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, toast]);

  useEffect(() => { load(1); }, [load]);

  const fmtDate = (d) => d ? new Date(d).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";

  // Summary cards from stats
  const summaryCards = [
    { key: "topup",          label: "Tổng nạp tiền",  abbr: "NT", color: "#16a34a" },
    { key: "escrow_deposit", label: "Tổng ký quỹ",    abbr: "KQ", color: "#1d4ed8" },
    { key: "escrow_release", label: "Tổng giải ngân", abbr: "GN", color: "#7c3aed" },
    { key: "refund",         label: "Tổng hoàn tiền", abbr: "HT", color: "#d97706" },
  ];

  return (
    <>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Quản lý Giao dịch</h1>
          <p className="adm-page-subtitle">Theo dõi toàn bộ luồng tiền trên hệ thống</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="adm-kpis" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        {summaryCards.map(c => (
          <div className="adm-kpi" key={c.key} style={{ "--kpi-color": c.color }}>
            <div className="adm-kpi-icon" style={{ background: c.color + "22", color: c.color, fontSize: 12, fontWeight: 700 }}>{c.abbr}</div>
            <div className="adm-kpi-body">
              <span className="adm-kpi-val money">{formatMoney(stats[c.key]?.totalAmount || 0)}</span>
              <span className="adm-kpi-label">{c.label}</span>
              <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{stats[c.key]?.count || 0} giao dịch</span>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-card">
        <div className="adm-filters">
          <select className="adm-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            {TYPE_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <select className="adm-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="adm-loading">Đang tải...</div>
        ) : transactions.length === 0 ? (
          <div className="adm-empty">
            <p>Không có giao dịch nào</p>
          </div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Người dùng</th>
                    <th>Số tiền</th>
                    <th>Phương thức</th>
                    <th>Mô tả</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => {
                    const tm = TYPE_META[t.type] || { label: t.type, cls: "adm-badge-gray" };
                    const sm = STATUS_META[t.status] || { label: t.status, cls: "adm-badge-gray" };
                    return (
                      <tr key={t._id}>
                        <td>
                          <span className={`adm-badge ${tm.cls}`}>
                            {tm.label}
                          </span>
                        </td>
                        <td>
                          {t.userId ? (
                            <div>
                              <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{t.userId.fullName}</div>
                              {/* Email ẩn: admin không được xem email người dùng. */}
                              {/* <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.userId.email}</div> */}
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: 14, color: t.type === "topup" || t.type === "escrow_release" ? "#16a34a" : t.type === "escrow_deposit" ? "#1d4ed8" : "#d97706" }}>
                            {t.type === "topup" || t.type === "escrow_release" ? "+" : "-"}{formatMoney(t.amount)}
                          </span>
                        </td>
                        <td>
                          <span className="adm-badge adm-badge-gray">{METHOD_LABELS[t.paymentMethod] || t.paymentMethod}</span>
                        </td>
                        <td style={{ color: "#64748b", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.description}
                        </td>
                        <td><span className={`adm-badge ${sm.cls}`}>{sm.label}</span></td>
                        <td style={{ color: "#64748b", fontSize: 12 }}>{fmtDate(t.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="adm-pagination">
              <span>Trang {pagination.page} / {pagination.totalPages} — {pagination.total} giao dịch</span>
              <div className="adm-pagination-btns">
                <button className="adm-pagination-btn" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>← Trước</button>
                <button className="adm-pagination-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Tiếp →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
