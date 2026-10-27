import { useEffect, useState, useCallback } from "react";
import adminService from "../../../services/admin.service";
import { useToast } from "../../../contexts/ToastContext";

const ROLE_LABELS = { farmer: "Nông dân", enterprise: "Doanh nghiệp" };
const CATEGORY_LABELS = {
  bug: "Báo lỗi",
  feature: "Đề xuất tính năng",
  ux: "Giao diện",
  payment: "Thanh toán",
  other: "Khác",
};
const STATUS_META = {
  new: { label: "Mới gửi", cls: "adm-badge-red" },
  read: { label: "Đã xem", cls: "adm-badge-blue" },
  resolved: { label: "Đã xử lý", cls: "adm-badge-green" },
};

export default function QuanLyFeedback() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [unresolved, setUnresolved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (roleFilter) params.role = roleFilter;
      if (categoryFilter) params.category = categoryFilter;
      const res = await adminService.getFeedbacks(params);
      setItems(res?.data || []);
      if (res?.pagination) setPagination(res.pagination);
      if (typeof res?.unresolved === "number") setUnresolved(res.unresolved);
    } catch {
      toast.error("Không thể tải danh sách phản hồi");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, roleFilter, categoryFilter, toast]);

  useEffect(() => { load(1); }, [load]);

  const openDetail = (item) => {
    setSelected(item);
    setNoteDraft(item.adminNote || "");
    // Tự đánh dấu "đã xem" khi admin mở phản hồi còn mới.
    if (item.status === "new") updateStatus(item, "read", { silent: true });
  };

  const updateStatus = async (item, status, opts = {}) => {
    try {
      const res = await adminService.updateFeedbackStatus(item._id, status, opts.note ?? item.adminNote ?? "");
      const updated = res?.data?.feedback;
      setItems(prev => prev.map(f => f._id === item._id ? { ...f, ...updated } : f));
      setSelected(prev => prev && prev._id === item._id ? { ...prev, ...updated } : prev);
      setUnresolved(prev => {
        const wasResolved = item.status === "resolved";
        const nowResolved = status === "resolved";
        if (!wasResolved && nowResolved) return Math.max(0, prev - 1);
        if (wasResolved && !nowResolved) return prev + 1;
        return prev;
      });
      if (!opts.silent) toast.success("Đã cập nhật trạng thái phản hồi");
    } catch {
      if (!opts.silent) toast.error("Không thể cập nhật phản hồi");
    }
  };

  const saveNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    await updateStatus(selected, selected.status === "new" ? "read" : selected.status, { note: noteDraft });
    setSavingNote(false);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString("vi-VN") : "—";

  return (
    <>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Phản hồi hệ thống</h1>
          <p className="adm-page-subtitle">
            Tổng cộng {pagination.total} phản hồi
            {unresolved > 0 && <> — <strong style={{ color: "#dc2626" }}>{unresolved} chưa xử lý</strong></>}
          </p>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-filters">
          <select className="adm-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="new">Mới gửi</option>
            <option value="read">Đã xem</option>
            <option value="resolved">Đã xử lý</option>
          </select>
          <select className="adm-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">Tất cả vai trò</option>
            <option value="farmer">Nông dân</option>
            <option value="enterprise">Doanh nghiệp</option>
          </select>
          <select className="adm-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">Tất cả loại</option>
            <option value="bug">Báo lỗi</option>
            <option value="feature">Đề xuất tính năng</option>
            <option value="ux">Giao diện</option>
            <option value="payment">Thanh toán</option>
            <option value="other">Khác</option>
          </select>
          <button className="adm-btn adm-btn-primary" onClick={() => load(1)}>Lọc</button>
        </div>

        {loading ? (
          <div className="adm-loading">Đang tải...</div>
        ) : items.length === 0 ? (
          <div className="adm-empty"><p>Chưa có phản hồi nào</p></div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Người gửi</th>
                    <th>Vai trò</th>
                    <th>Loại</th>
                    <th>Tiêu đề</th>
                    <th>Trạng thái</th>
                    <th>Ngày gửi</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const meta = STATUS_META[item.status] || STATUS_META.new;
                    return (
                      <tr key={item._id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "#1e293b" }}>{item.userName}</div>
                          {/* Email ẩn: admin không được xem email người dùng. */}
                          {/* <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.userEmail}</div> */}
                        </td>
                        <td>
                          <span className={`adm-badge ${item.userRole === "farmer" ? "adm-badge-green" : "adm-badge-blue"}`}>
                            {ROLE_LABELS[item.userRole] || item.userRole}
                          </span>
                        </td>
                        <td style={{ color: "#64748b" }}>{CATEGORY_LABELS[item.category] || "Khác"}</td>
                        <td style={{ maxWidth: 280, fontWeight: 600, color: "#1e293b" }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subject}</div>
                        </td>
                        <td><span className={`adm-badge ${meta.cls}`}>{meta.label}</span></td>
                        <td style={{ color: "#64748b" }}>{fmtDate(item.createdAt)}</td>
                        <td>
                          <button className="adm-btn adm-btn-outline" onClick={() => openDetail(item)}>Xem</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="adm-pagination">
              <span>Trang {pagination.page} / {pagination.totalPages} — {pagination.total} phản hồi</span>
              <div className="adm-pagination-btns">
                <button className="adm-pagination-btn" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>← Trước</button>
                <button className="adm-pagination-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Tiếp →</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="adm-modal-overlay" onClick={() => setSelected(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-hd">
              <h3>Chi tiết phản hồi</h3>
              <button className="adm-modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="adm-modal-body">
              <div className="adm-detail-row"><span className="adm-detail-label">Người gửi</span><span className="adm-detail-val">{selected.userName}</span></div>
              {/* Email ẩn: admin không được xem email người dùng. */}
              {/* <div className="adm-detail-row"><span className="adm-detail-label">Email</span><span className="adm-detail-val">{selected.userEmail}</span></div> */}
              <div className="adm-detail-row"><span className="adm-detail-label">Vai trò</span><span className="adm-detail-val">{ROLE_LABELS[selected.userRole] || selected.userRole}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Loại</span><span className="adm-detail-val">{CATEGORY_LABELS[selected.category] || "Khác"}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Trạng thái</span><span className="adm-detail-val"><span className={`adm-badge ${(STATUS_META[selected.status] || STATUS_META.new).cls}`}>{(STATUS_META[selected.status] || STATUS_META.new).label}</span></span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Ngày gửi</span><span className="adm-detail-val">{fmtDate(selected.createdAt)}</span></div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Tiêu đề</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 14 }}>{selected.subject}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Nội dung</div>
                <div style={{ fontSize: 14, color: "#475569", whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f8fafc", border: "1px solid #eef2f0", borderRadius: 10, padding: 14 }}>
                  {selected.message}
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "16px 0 6px" }}>Ghi chú / Phản hồi của Admin (tùy chọn)</div>
                <textarea
                  className="adm-search"
                  style={{ width: "100%", minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
                  placeholder="Nội dung này sẽ hiển thị cho người gửi..."
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                />
              </div>
            </div>
            <div className="adm-modal-ft">
              <button className="adm-btn adm-btn-primary" onClick={saveNote} disabled={savingNote}>
                {savingNote ? "Đang lưu..." : "Lưu ghi chú"}
              </button>
              {selected.status !== "resolved" ? (
                <button className="adm-btn adm-btn-success" onClick={() => updateStatus(selected, "resolved", { note: noteDraft })}>
                  Đánh dấu đã xử lý
                </button>
              ) : (
                <button className="adm-btn adm-btn-outline" onClick={() => updateStatus(selected, "read", { note: noteDraft })}>
                  Mở lại (chưa xử lý)
                </button>
              )}
              <button className="adm-btn adm-btn-outline" onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
