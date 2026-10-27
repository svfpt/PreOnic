import { useEffect, useState, useCallback } from "react";
import { FiAlertTriangle, FiCheckCircle, FiX } from "react-icons/fi";
import adminService from "../../../services/admin.service";
import { formatMoney } from "../../../hooks/useApiData";
import { useToast } from "../../../contexts/ToastContext";

const STATUS_META = {
  pending:   { label: "Chờ duyệt", cls: "adm-badge-yellow" },
  completed: { label: "Đã chuyển", cls: "adm-badge-green" },
  rejected:  { label: "Từ chối",   cls: "adm-badge-red" },
};

const STATUS_OPTIONS = [
  { val: "pending", label: "Chờ duyệt" },
  { val: "completed", label: "Đã chuyển" },
  { val: "rejected", label: "Từ chối" },
  { val: "", label: "Tất cả" },
];

// --- Custom confirm modal ---
function ConfirmModal({ open, title, message, detail, confirmLabel, confirmCls, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="adm-modal-overlay" onClick={onCancel}>
      <div className="adm-modal adm-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="adm-modal-hd">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiCheckCircle size={18} color="#16a34a" />
            <h3 style={{ margin: 0 }}>{title}</h3>
          </span>
          <button className="adm-modal-close" onClick={onCancel}><FiX size={16} /></button>
        </div>
        <div className="adm-modal-body">
          <p style={{ margin: "0 0 8px", color: "#334155", fontSize: 14 }}>{message}</p>
          {detail && <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{detail}</p>}
        </div>
        <div className="adm-modal-ft">
          <button className="adm-btn adm-btn-ghost" onClick={onCancel}>Hủy</button>
          <button
            className="adm-btn"
            style={{ background: confirmCls || "#16a34a", color: "#fff", border: "none" }}
            onClick={onConfirm}
          >
            {confirmLabel || "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Custom prompt modal (reject with reason) ---
function RejectModal({ open, request, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  const submit = () => { onConfirm(reason); setReason(""); };
  const cancel = () => { setReason(""); onCancel(); };
  return (
    <div className="adm-modal-overlay" onClick={cancel}>
      <div className="adm-modal adm-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="adm-modal-hd adm-modal-hd-danger">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiAlertTriangle size={18} color="#dc2626" />
            <h3 style={{ margin: 0 }}>Từ chối yêu cầu rút tiền</h3>
          </span>
          <button className="adm-modal-close" onClick={cancel}><FiX size={16} /></button>
        </div>
        <div className="adm-modal-body">
          {request && (
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#475569" }}>
              <div><strong>{request.bankAccountHolder}</strong> — {formatMoney(request.amount)}</div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{request.bankName} · {request.bankAccountNumber}</div>
            </div>
          )}
          <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
            Lý do từ chối <span style={{ fontWeight: 400, color: "#94a3b8" }}>(không bắt buộc)</span>
          </label>
          <textarea
            autoFocus
            rows={3}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, color: "#334155", resize: "vertical", outline: "none", fontFamily: "inherit" }}
            placeholder="Nhập lý do từ chối để thông báo cho người dùng..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            onKeyDown={e => e.key === "Enter" && e.ctrlKey && submit()}
          />
        </div>
        <div className="adm-modal-ft">
          <button className="adm-btn adm-btn-ghost" onClick={cancel}>Hủy</button>
          <button
            className="adm-btn"
            style={{ background: "#dc2626", color: "#fff", border: "none" }}
            onClick={submit}
          >
            Xác nhận từ chối
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuanLyRutTien() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionId, setActionId] = useState(null);

  // modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, request: null });
  const [rejectModal, setRejectModal]   = useState({ open: false, request: null });

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await adminService.getWithdrawals(params);
      const data = res?.data || {};
      setRequests(data.requests || []);
      setPagination({ page: data.page || 1, total: data.total || 0, totalPages: data.totalPages || 1 });
    } catch {
      toast.error("Không thể tải danh sách yêu cầu rút tiền");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { load(1); }, [load]);

  const fmtDate = (d) => d ? new Date(d).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";

  // open modals
  const handleComplete = (r) => setConfirmModal({ open: true, request: r });
  const handleReject   = (r) => setRejectModal({ open: true, request: r });

  // confirm complete
  const doComplete = async () => {
    const r = confirmModal.request;
    setConfirmModal({ open: false, request: null });
    setActionId(r._id);
    try {
      await adminService.completeWithdrawal(r._id, "");
      toast.success("Đã hoàn tất rút tiền và trừ số dư người dùng.");
      await load(pagination.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Thao tác thất bại");
    } finally {
      setActionId(null);
    }
  };

  // confirm reject
  const doReject = async (reason) => {
    const r = rejectModal.request;
    setRejectModal({ open: false, request: null });
    setActionId(r._id);
    try {
      await adminService.rejectWithdrawal(r._id, reason);
      toast.success("Đã từ chối đơn rút tiền.");
      await load(pagination.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Thao tác thất bại");
    } finally {
      setActionId(null);
    }
  };

  return (
    <>
      {/* Confirm complete modal */}
      <ConfirmModal
        open={confirmModal.open}
        title="Xác nhận đã chuyển khoản"
        message={
          confirmModal.request
            ? `Xác nhận ĐÃ CHUYỂN KHOẢN ${formatMoney(confirmModal.request.amount)} cho ${confirmModal.request.bankAccountHolder}?`
            : ""
        }
        detail="Hệ thống sẽ trừ số tiền này khỏi số dư của người dùng."
        confirmLabel="Đã chuyển khoản"
        onConfirm={doComplete}
        onCancel={() => setConfirmModal({ open: false, request: null })}
      />

      {/* Reject modal */}
      <RejectModal
        open={rejectModal.open}
        request={rejectModal.request}
        onConfirm={doReject}
        onCancel={() => setRejectModal({ open: false, request: null })}
      />

      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Quản lý Rút tiền</h1>
          <p className="adm-page-subtitle">Xét duyệt yêu cầu rút tiền — xác nhận đã chuyển khoản để trừ số dư người dùng</p>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-filters">
          <select className="adm-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="adm-loading">Đang tải...</div>
        ) : requests.length === 0 ? (
          <div className="adm-empty"><p>Không có yêu cầu rút tiền nào</p></div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Số tiền</th>
                    <th>Ngân hàng nhận</th>
                    <th>Ghi chú</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => {
                    const sm = STATUS_META[r.status] || { label: r.status, cls: "adm-badge-gray" };
                    const busy = actionId === r._id;
                    return (
                      <tr key={r._id}>
                        <td>
                          {r.userId ? (
                            <div>
                              <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{r.userId.fullName}</div>
                              {/* Email ẩn: admin không được xem email người dùng. */}
                              {/* <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.userId.email}</div> */}
                              <div style={{ fontSize: 11, color: "#94a3b8" }}>Số dư: {formatMoney(r.userId.virtualBalance || 0)}</div>
                            </div>
                          ) : <span style={{ color: "#94a3b8" }}>—</span>}
                        </td>
                        <td><span style={{ fontWeight: 700, fontSize: 14, color: "#b91c1c" }}>-{formatMoney(r.amount)}</span></td>
                        <td style={{ fontSize: 12.5, color: "#475569" }}>
                          <div style={{ fontWeight: 600 }}>{r.bankName}</div>
                          <div>{r.bankAccountNumber}</div>
                          <div style={{ color: "#94a3b8" }}>{r.bankAccountHolder}</div>
                        </td>
                        <td style={{ color: "#64748b", fontSize: 12, maxWidth: 160 }}>{r.note || "—"}</td>
                        <td><span className={`adm-badge ${sm.cls}`}>{sm.label}</span></td>
                        <td style={{ color: "#64748b", fontSize: 12 }}>{fmtDate(r.createdAt)}</td>
                        <td>
                          {r.status === "pending" ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                disabled={busy}
                                onClick={() => handleComplete(r)}
                                style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: busy ? "#d1d5db" : "#16a34a", color: "#fff", fontWeight: 700, fontSize: 12, cursor: busy ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                              >
                                {busy ? "..." : "Đã chuyển"}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => handleReject(r)}
                                style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #fecaca", background: "#fff", color: "#dc2626", fontWeight: 600, fontSize: 12, cursor: busy ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>
                              {r.processedBy?.fullName ? `bởi ${r.processedBy.fullName}` : "Đã xử lý"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="adm-pagination">
              <span>Trang {pagination.page} / {pagination.totalPages} — {pagination.total} yêu cầu</span>
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
