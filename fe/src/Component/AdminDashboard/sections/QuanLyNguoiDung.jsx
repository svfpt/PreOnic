import { useEffect, useState, useCallback } from "react";
import adminService from "../../../services/admin.service";
// formatMoney tạm bỏ vì cột "Số dư ví" đã ẩn — import lại khi kích hoạt cột.
// import { formatMoney } from "../../../hooks/useApiData";
import { useToast } from "../../../contexts/ToastContext";

const ROLE_LABELS = { farmer: "Nông dân", enterprise: "Doanh nghiệp" };

export default function QuanLyNguoiDung() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // user object to confirm delete
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter !== "") params.isActive = statusFilter;
      const res = await adminService.getUsers(params);
      setUsers(res?.data || []);
      if (res?.pagination) setPagination(res.pagination);
    } catch {
      toast.error("Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, toast]);

  useEffect(() => { load(1); }, [load]);

  const openDetail = async (userId) => {
    setSelectedUser({ _id: userId, loading: true });
    try {
      const res = await adminService.getUserDetail(userId);
      setSelectedUser({ ...res?.data?.user, contractCount: res?.data?.contractCount, transactionCount: res?.data?.transactionCount });
    } catch {
      toast.error("Không thể tải chi tiết người dùng");
      setSelectedUser(null);
    }
  };

  const handleToggle = async (userId, currentStatus) => {
    setToggling(userId);
    try {
      await adminService.toggleUserStatus(userId);
      toast.success(`Tài khoản đã ${currentStatus ? "vô hiệu hóa" : "kích hoạt"}`);
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isActive: !u.isActive } : u));
      if (selectedUser?._id === userId) {
        setSelectedUser(prev => ({ ...prev, isActive: !prev.isActive }));
      }
    } catch {
      toast.error("Không thể thay đổi trạng thái tài khoản");
    } finally {
      setToggling(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminService.deleteUser(deleteTarget._id);
      toast.success(`Đã xóa tài khoản "${deleteTarget.fullName}"`);
      setUsers(prev => prev.filter(u => u._id !== deleteTarget._id));
      setPagination(prev => ({ ...prev, total: prev.total - 1 }));
      if (selectedUser?._id === deleteTarget._id) setSelectedUser(null);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể xóa tài khoản");
    } finally {
      setDeleting(false);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

  return (
    <>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Quản lý Người dùng</h1>
          <p className="adm-page-subtitle">Tổng cộng {pagination.total} người dùng</p>
        </div>
      </div>

      {/* Filters */}
      <div className="adm-card">
        <div className="adm-filters">
          <input
            className="adm-search"
            type="text"
            placeholder="Tìm theo tên, SĐT..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(1)}
          />
          <select className="adm-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">Tất cả vai trò</option>
            <option value="farmer">Nông dân</option>
            <option value="enterprise">Doanh nghiệp</option>
          </select>
          <select className="adm-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã vô hiệu hóa</option>
          </select>
          <button className="adm-btn adm-btn-primary" onClick={() => load(1)}>Tìm kiếm</button>
        </div>

        {loading ? (
          <div className="adm-loading">Đang tải...</div>
        ) : users.length === 0 ? (
          <div className="adm-empty"><p>Không tìm thấy người dùng nào</p></div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    {/* Cột Email tạm ẩn theo yêu cầu — bỏ comment để kích hoạt lại sau. */}
                    {/* <th>Email</th> */}
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    {/* Cột Số dư ví ẩn: admin không được xem số dư người dùng. */}
                    {/* <th>Số dư ví</th> */}
                    <th>Ngày tham gia</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: u.role === "farmer" ? "#dcfce7" : "#dbeafe", color: u.role === "farmer" ? "#16a34a" : "#1d4ed8", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {(u.fullName || "?").slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{u.fullName}</span>
                        </div>
                      </td>
                      {/* Cột Email tạm ẩn theo yêu cầu — bỏ comment để kích hoạt lại sau. */}
                      {/* <td style={{ color: "#64748b" }}>{u.email}</td> */}
                      <td>
                        <span className={`adm-badge ${u.role === "farmer" ? "adm-badge-green" : "adm-badge-blue"}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`adm-badge ${u.isActive ? "adm-badge-green" : "adm-badge-red"}`}>
                          {u.isActive ? "Hoạt động" : "Vô hiệu hóa"}
                        </span>
                      </td>
                      {/* Số dư ví ẩn: admin không được xem số dư người dùng. */}
                      {/* <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{formatMoney(u.virtualBalance || 0)}</td> */}
                      <td style={{ color: "#64748b" }}>{fmtDate(u.createdAt)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="adm-btn adm-btn-outline" onClick={() => openDetail(u._id)}>Chi tiết</button>
                          <button
                            className={`adm-btn ${u.isActive ? "adm-btn-danger" : "adm-btn-success"}`}
                            onClick={() => handleToggle(u._id, u.isActive)}
                            disabled={toggling === u._id}
                          >
                            {toggling === u._id ? "..." : u.isActive ? "Khóa" : "Mở khóa"}
                          </button>
                          <button
                            className="adm-btn adm-btn-delete"
                            onClick={() => setDeleteTarget(u)}
                            title="Xóa tài khoản vĩnh viễn"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="adm-pagination">
              <span>Trang {pagination.page} / {pagination.totalPages} — {pagination.total} người dùng</span>
              <div className="adm-pagination-btns">
                <button className="adm-pagination-btn" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>← Trước</button>
                <button className="adm-pagination-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Tiếp →</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedUser && (
        <div className="adm-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-hd">
              <h3>Chi tiết người dùng</h3>
              <button className="adm-modal-close" onClick={() => setSelectedUser(null)}>×</button>
            </div>
            <div className="adm-modal-body">
              {selectedUser.loading ? (
                <div className="adm-loading">Đang tải...</div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: selectedUser.role === "farmer" ? "#dcfce7" : "#dbeafe", color: selectedUser.role === "farmer" ? "#16a34a" : "#1d4ed8", fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {(selectedUser.fullName || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>{selectedUser.fullName}</div>
                      {/* Email ẩn: admin không được xem email người dùng. */}
                      {/* <div style={{ fontSize: 12, color: "#64748b" }}>{selectedUser.email}</div> */}
                    </div>
                  </div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Vai trò</span><span className="adm-detail-val">{ROLE_LABELS[selectedUser.role] || selectedUser.role}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Trạng thái</span><span className="adm-detail-val"><span className={`adm-badge ${selectedUser.isActive ? "adm-badge-green" : "adm-badge-red"}`}>{selectedUser.isActive ? "Hoạt động" : "Vô hiệu hóa"}</span></span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Xác minh email</span><span className="adm-detail-val">{selectedUser.isVerified ? "Đã xác minh" : "Chưa xác minh"}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Số điện thoại</span><span className="adm-detail-val">{selectedUser.phone || "—"}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Tỉnh/TP</span><span className="adm-detail-val">{selectedUser.province || "—"}</span></div>
                  {/* Số dư ví ẩn: admin không được xem số dư người dùng. */}
                  {/* <div className="adm-detail-row"><span className="adm-detail-label">Số dư ví</span><span className="adm-detail-val" style={{ color: "#1d4ed8" }}>{formatMoney(selectedUser.virtualBalance || 0)}</span></div> */}
                  <div className="adm-detail-row"><span className="adm-detail-label">Điểm uy tín</span><span className="adm-detail-val">{selectedUser.reputationScore?.toFixed(1) || "—"} / 5.0</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Hợp đồng liên quan</span><span className="adm-detail-val">{selectedUser.contractCount ?? "—"}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Giao dịch hoàn thành</span><span className="adm-detail-val">{selectedUser.transactionCount ?? "—"}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Đăng nhập lần cuối</span><span className="adm-detail-val">{fmtDate(selectedUser.lastLogin)}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Ngày tạo</span><span className="adm-detail-val">{fmtDate(selectedUser.createdAt)}</span></div>
                </>
              )}
            </div>
            {!selectedUser.loading && (
              <div className="adm-modal-ft">
                <button
                  className={`adm-btn ${selectedUser.isActive ? "adm-btn-danger" : "adm-btn-success"}`}
                  onClick={() => handleToggle(selectedUser._id, selectedUser.isActive)}
                  disabled={toggling === selectedUser._id}
                >
                  {toggling === selectedUser._id ? "Đang xử lý..." : selectedUser.isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                </button>
                <button
                  className="adm-btn adm-btn-delete"
                  onClick={() => { setSelectedUser(null); setDeleteTarget(selectedUser); }}
                >
                  Xóa tài khoản
                </button>
                <button className="adm-btn adm-btn-outline" onClick={() => setSelectedUser(null)}>Đóng</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="adm-modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="adm-modal adm-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-hd adm-modal-hd-danger">
              <div className="adm-delete-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 26, height: 26 }}>
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" strokeLinecap="round" />
                </svg>
              </div>
              <h3>Xóa tài khoản</h3>
            </div>
            <div className="adm-modal-body">
              <div className="adm-delete-warning">
                <p>Bạn sắp xóa vĩnh viễn tài khoản:</p>
                <div className="adm-delete-target">
                  <strong>{deleteTarget.fullName}</strong>
                  {/* Email ẩn: admin không được xem email người dùng. */}
                  {/* <span>{deleteTarget.email}</span> */}
                </div>
                <p className="adm-delete-note">
                  Hành động này <strong>không thể hoàn tác</strong>. Tài khoản sẽ bị xóa khỏi hệ thống. Tài khoản đang có hợp đồng đang hoạt động sẽ không thể xóa.
                </p>
              </div>
            </div>
            <div className="adm-modal-ft">
              <button
                className="adm-btn adm-btn-delete"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
              <button
                className="adm-btn adm-btn-outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
